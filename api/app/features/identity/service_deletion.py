"""Closing one's own account (UK GDPR Art. 17), in the baseline's order.

Baseline: `backend/app/features/settings/account_deletion.py:29-56`. The steps:

1. refuse staff, then a wrong password, then the gates (money in flight, an accepted
   booking still to happen, an open problem report);
2. cancel pending unpaid enquiries, erase what the person owns, tombstone the `users`
   row, wipe a vendor listing and end every sign-in;
3. best-effort outside clean-up: stored files, the "account deleted" email and the
   Stripe Connect account. A failure there is logged and never undoes the closure.

The database writes share the request's one transaction, so they all land or none do.
Closed accounts are tombstones: the row is never deleted and never restored.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway, Storage
from app.features.bookings import service_account_closure as booking_closure
from app.features.disputes import service_participant as disputes
from app.features.identity import domain_deletion, repository, repository_deletion
from app.features.identity.domain_accounts import normalise_email
from app.features.identity.domain_deletion import DeletionGate
from app.features.identity.errors import (
    AccountDeletionActiveBooking,
    AccountDeletionForbiddenForAdmin,
    AccountDeletionMoneyInFlight,
    AccountDeletionOpenDispute,
    CurrentPasswordIncorrect,
)
from app.features.identity.schemas import AccountDeletionResponse
from app.features.identity.tokens import verify_password
from app.features.notifications import service as notifications

log = get_logger(__name__)

_GATE_ERRORS = {
    "money_in_flight": AccountDeletionMoneyInFlight,
    "active_booking": AccountDeletionActiveBooking,
    "open_dispute": AccountDeletionOpenDispute,
}


async def delete_own_account(
    session: AsyncSession,
    mailer: Mailer,
    storage: Storage,
    gateway: PaymentGateway,
    *,
    principal: Principal,
    password: str,
) -> AccountDeletionResponse:
    """Close the caller's client or vendor account, or raise the refusal that stops it."""
    if principal.user_type == "admin":
        raise AccountDeletionForbiddenForAdmin()
    email = normalise_email(principal.email)
    credentials = await repository.get_credentials(session, principal.id)
    if not email or credentials is None or not verify_password(credentials.password_hash, password):
        raise CurrentPasswordIncorrect()
    gate = await _failing_gate(session, principal.id)
    if gate is not None:
        raise _GATE_ERRORS[gate]()

    now = datetime.now(UTC)
    stripe_account_id = await repository_deletion.vendor_stripe_account_id(session, principal.id)
    await booking_closure.cancel_open_requests_on_closure(session, mailer, principal.id)
    await booking_closure.erase_client_booking_extras(session, principal.id)
    await repository_deletion.redact_sent_messages(session, principal.id)
    await repository_deletion.delete_personal_rows(session, principal.id)
    await repository_deletion.delete_client_planner(session, principal.id)
    await repository_deletion.redact_logs(session, principal.id)
    review_image_urls = await repository_deletion.clear_review_images(session, principal.id)
    await repository_deletion.tombstone_user(session, principal.id, now=now)
    await repository_deletion.wipe_vendor_listing(session, principal.id, now=now)
    # Stands in for the baseline's Supabase auth-user delete: every refresh token stops working,
    # and access tokens are refused because the account now reads as deleted.
    await repository.revoke_all_chains_for_user(
        session, user_id=principal.id, at=now, reason="account_deleted"
    )

    _delete_stored_files(storage, user_id=principal.id, review_image_urls=review_image_urls)
    # The baseline emails before erasing (it had no other copy of the address); here the address
    # was captured up front, so the email waits until every database write has succeeded.
    notifications.send_account_deleted(mailer, email=email)
    if stripe_account_id:
        await _delete_connect_account(gateway, user_id=principal.id, account_id=stripe_account_id)
    # Deferred: the baseline also deletes the Mixpanel profile (needs an analytics port; awaiting approval).
    log.info("account deleted user_id=%s", principal.id)
    return AccountDeletionResponse(message=domain_deletion.ACCOUNT_DELETED_MESSAGE)


async def _failing_gate(session: AsyncSession, user_id: str) -> DeletionGate | None:
    """The first gate refusing to close this account, if any (baseline `account_deletion_gates.py:31-50`)."""
    bookings = await booking_closure.closure_blockers(session, user_id)
    own_disputes = await disputes.list_own_disputes(session, user_id)
    has_open_dispute = any(domain_deletion.is_open_dispute(dispute.status) for dispute in own_disputes)
    return domain_deletion.failing_gate(bookings, has_open_dispute=has_open_dispute)


def _delete_stored_files(storage: Storage, *, user_id: str, review_image_urls: list[str]) -> None:
    """Delete review photos and everything under the account's upload prefix; failures are only logged."""
    if not storage.is_configured():
        return
    storage_host = storage.public_host()
    for image_url in review_image_urls:
        object_key = domain_deletion.own_object_key(image_url, storage_host)
        if object_key is None:
            continue
        try:
            storage.delete_object(object_key)
        except Exception:
            log.warning("account_deletion: delete review image failed user=%s key=%s", user_id, object_key)
    prefix = domain_deletion.user_storage_prefix(user_id)
    if prefix is None:
        return
    try:
        storage.delete_prefix(prefix)
    except Exception:
        log.warning("account_deletion: delete user storage failed user=%s", user_id)


async def _delete_connect_account(gateway: PaymentGateway, *, user_id: str, account_id: str) -> None:
    """Delete the vendor's Stripe Connect account; a refusal or outage is only logged (baseline `:59-66`)."""
    try:
        await gateway.delete_account(account_id)
    except Exception:
        log.warning("account_deletion: Stripe Connect cleanup failed user=%s", user_id)
