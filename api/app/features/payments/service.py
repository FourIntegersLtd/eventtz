"""Vendor payout setup (Stripe Connect Express) and the Stripe webhook.

Connect state lives on the vendor's row; Stripe is only asked while onboarding is
unfinished (or when the vendor starts it), and `account.updated` keeps it current
afterwards. The booking money flows a webhook triggers are the bookings slice's
(`service_payments_checkout`); this module verifies, deduplicates and dispatches.
"""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.core.ports import Mailer, PaymentGateway, PaymentGatewayError
from app.core.settings import get_settings
from app.features.bookings import service_payments, service_payments_checkout, service_payout_ledger
from app.features.identity import service as identity
from app.features.payments import domain, repository
from app.features.payments.errors import (
    CONNECT_LINK_SYNC_FAILED_MESSAGE,
    ConnectAccountResolveFailed,
    InvalidStripeSignature,
    MissingStripeSignature,
    PayoutTransferNotFound,
    StripeConnectRestoreFailed,
    StripeConnectRestoreRequired,
    StripeConnectSyncFailed,
    StripeConnectUnavailable,
    StripeNotConfigured,
    StripeWebhookHandlerFailed,
)
from app.features.payments.schemas import (
    AdminVendorRestoreStripeConnectResponse,
    ConnectState,
    VendorPaymentsStatusResponse,
    VendorPayoutHistoryResponse,
)
from app.features.staff import service as staff
from app.features.vendors import service_payouts as vendor_payouts
from app.features.vendors import service_profile as vendor_profiles

log = get_logger(__name__)

# The webhook event types Eventtz acts on; every other type is acknowledged and ignored.
CHECKOUT_COMPLETED = "checkout.session.completed"
ACCOUNT_UPDATED = "account.updated"
# Money moving outside the app: a card chargeback, and a refund made in the Stripe dashboard.
CHARGE_DISPUTE_CREATED = "charge.dispute.created"
CHARGE_DISPUTE_CLOSED = "charge.dispute.closed"
CHARGE_REFUNDED = "charge.refunded"
HANDLED_EVENT_TYPES = (
    CHECKOUT_COMPLETED,
    ACCOUNT_UPDATED,
    CHARGE_DISPUTE_CREATED,
    CHARGE_DISPUTE_CLOSED,
    CHARGE_REFUNDED,
)
# Stripe's error text is kept in logs, trimmed like the baseline's audit detail.
_MAX_ERROR_DETAIL = 500


def _state_of(vendor: Any) -> ConnectState:
    """The stored Connect state of a vendor row (all empty before onboarding)."""
    if vendor is None:
        return ConnectState()
    return ConnectState(
        stripe_account_id=vendor.stripe_account_id,
        charges_enabled=bool(vendor.stripe_charges_enabled),
        payouts_enabled=bool(vendor.stripe_payouts_enabled),
    )


def _raise_if_platform_unavailable(error: PaymentGatewayError) -> None:
    """Turn "Eventtz's own Stripe platform cannot create Connect accounts yet" into its friendly 503."""
    if domain.is_platform_setup_error(error):
        log.error("payments: Stripe Connect platform not ready: %s", error.message)
        raise StripeConnectUnavailable() from error


async def _clear_orphan_account(
    session: AsyncSession, vendor_user_id: str, *, account_id: str, trigger: str, error: PaymentGatewayError
) -> bool:
    """Forget a Connect account Stripe no longer knows; False when the vendor's payout history forbids it.

    The baseline also wrote an audit row with an empty admin id, which its database
    always refused, so the record of a clear has only ever been this log line.
    """
    if await service_payout_ledger.vendor_has_payout_history(session, vendor_user_id):
        log.error(
            "payments: refused to clear Connect vendor=%s account=%s trigger=%s reason=payout_history_exists",
            vendor_user_id,
            account_id,
            trigger,
        )
        return False
    log.warning(
        "payments: clearing Connect vendor=%s account=%s trigger=%s error=%s",
        vendor_user_id,
        account_id,
        trigger,
        error.message[:_MAX_ERROR_DETAIL],
    )
    await vendor_payouts.clear_stripe_account(session, vendor_user_id)
    return True


async def _create_express_account(
    session: AsyncSession, gateway: PaymentGateway, vendor_user_id: str, vendor: Any
) -> str:
    """Open a Stripe Express account prefilled with what Eventtz knows, and remember it."""
    emails = await identity.emails_by_id(session, [vendor_user_id])
    prefill = domain.connect_prefill(emails.get(vendor_user_id), vendor.payload if vendor else None)
    try:
        account_id = await gateway.create_express_account(
            email=prefill.email, individual=prefill.individual, business_profile=prefill.business_profile
        )
    except PaymentGatewayError as error:
        _raise_if_platform_unavailable(error)
        raise
    await vendor_payouts.save_stripe_account(session, vendor_user_id, account_id)
    log.info("payments: created Connect account vendor=%s account=%s", vendor_user_id, account_id)
    return account_id


async def _account_link(gateway: PaymentGateway, account_id: str, safe_path: str) -> str:
    """A one-time onboarding URL that brings the vendor back to `safe_path`."""
    refresh_url, return_url = domain.connect_link_urls(get_settings().frontend_url, safe_path)
    try:
        return await gateway.create_account_link(
            account_id=account_id, refresh_url=refresh_url, return_url=return_url
        )
    except PaymentGatewayError as error:
        _raise_if_platform_unavailable(error)
        raise


async def start_connect_onboarding(
    session: AsyncSession, gateway: PaymentGateway, vendor_user_id: str, *, return_path: str
) -> str:
    """Create the vendor's Express account if needed and return an onboarding URL.

    A stored account Stripe no longer knows (a switched platform, a test account in
    live mode) is replaced, unless the vendor was paid through it: then staff must look first.
    """
    vendor = await vendor_payouts.vendor_for_payouts(session, vendor_user_id)
    account_id = vendor.stripe_account_id if vendor is not None else None

    if account_id:
        try:
            await gateway.retrieve_account(account_id)
        except PaymentGatewayError as error:
            if domain.is_orphan_account_error(error):
                if await service_payout_ledger.vendor_has_payout_history(session, vendor_user_id):
                    log.error(
                        "payments: onboarding blocked, orphan account has payouts vendor=%s account=%s",
                        vendor_user_id,
                        account_id,
                    )
                    raise StripeConnectRestoreRequired() from error
                if await _clear_orphan_account(
                    session,
                    vendor_user_id,
                    account_id=account_id,
                    trigger="connect_onboarding.retrieve",
                    error=error,
                ):
                    account_id = None
            elif domain.is_permission_error(error):
                log.error(
                    "payments: Stripe permission error reading Connect vendor=%s account=%s: %s",
                    vendor_user_id,
                    account_id,
                    error.message,
                )
                raise StripeConnectSyncFailed() from error
            else:
                raise

    if not account_id:
        account_id = await _create_express_account(session, gateway, vendor_user_id, vendor)

    safe_path = domain.safe_connect_return_path(return_path)
    try:
        return await _account_link(gateway, account_id, safe_path)
    except PaymentGatewayError as error:
        if not domain.is_orphan_account_error(error):
            if domain.is_permission_error(error):
                log.error(
                    "payments: Stripe permission error creating account link vendor=%s account=%s: %s",
                    vendor_user_id,
                    account_id,
                    error.message,
                )
                raise StripeConnectSyncFailed(CONNECT_LINK_SYNC_FAILED_MESSAGE) from error
            raise
        if await service_payout_ledger.vendor_has_payout_history(session, vendor_user_id):
            raise StripeConnectRestoreRequired() from error
        if await _clear_orphan_account(
            session,
            vendor_user_id,
            account_id=account_id,
            trigger="connect_onboarding.account_link",
            error=error,
        ):
            account_id = await _create_express_account(session, gateway, vendor_user_id, vendor)
        return await _account_link(gateway, account_id, safe_path)


async def sync_connect_account(
    session: AsyncSession, gateway: PaymentGateway, vendor_user_id: str
) -> ConnectState:
    """Read the account's charge and payout flags from Stripe and store them on the vendor.

    An orphaned account is cleared (when allowed); a permission error keeps the stored
    state, since it usually means a key mismatch rather than a missing account.
    """
    vendor = await vendor_payouts.vendor_for_payouts(session, vendor_user_id)
    if vendor is None or not vendor.stripe_account_id:
        return _state_of(vendor)
    account_id = vendor.stripe_account_id
    try:
        account = await gateway.retrieve_account(account_id)
    except PaymentGatewayError as error:
        if domain.is_orphan_account_error(error):
            if await _clear_orphan_account(
                session,
                vendor_user_id,
                account_id=account_id,
                trigger="sync_connect_account_status",
                error=error,
            ):
                return ConnectState()
            return _state_of(vendor)
        if domain.is_permission_error(error):
            log.error(
                "payments: Stripe permission error syncing Connect vendor=%s account=%s: %s",
                vendor_user_id,
                account_id,
                error.message,
            )
            return _state_of(vendor)
        raise
    charges_enabled = bool(account.get("charges_enabled"))
    payouts_enabled = bool(account.get("payouts_enabled"))
    await vendor_payouts.save_stripe_flags(
        session, vendor_user_id, charges_enabled=charges_enabled, payouts_enabled=payouts_enabled
    )
    return ConnectState(
        stripe_account_id=account_id, charges_enabled=charges_enabled, payouts_enabled=payouts_enabled
    )


async def connect_status(
    session: AsyncSession, gateway: PaymentGateway, vendor_user_id: str
) -> VendorPaymentsStatusResponse:
    """The vendor's payout setup: stored flags, refreshed from Stripe only while onboarding is unfinished."""
    vendor = await vendor_payouts.vendor_for_payouts(session, vendor_user_id)
    state = _state_of(vendor)
    onboarding_unfinished = bool(state.stripe_account_id) and not (
        state.charges_enabled and state.payouts_enabled
    )
    if onboarding_unfinished and gateway.is_configured():
        state = await sync_connect_account(session, gateway, vendor_user_id)
    return VendorPaymentsStatusResponse(
        **state.model_dump(),
        can_accept_bookings=await vendor_profiles.payouts_ready_for_bookings(session, vendor_user_id),
        payout_gate_waived=vendor_payouts.payout_gate_waived(vendor),
    )


async def _restore_connect_state(
    session: AsyncSession, gateway: PaymentGateway, vendor_user_id: str
) -> tuple[ConnectState, str]:
    """Find the vendor's Connect account through their latest payout Transfer and store it.

    Returns the restored state and the Transfer id it came from.
    """
    transfer_id = await service_payout_ledger.latest_payout_transfer_id(session, vendor_user_id)
    if not transfer_id:
        raise PayoutTransferNotFound()
    transfer = await gateway.retrieve_transfer(transfer_id)
    account_id = str(transfer.get("destination") or "").strip()
    if not account_id.startswith("acct_"):
        raise ConnectAccountResolveFailed()
    account = await gateway.retrieve_account(account_id)
    charges_enabled = bool(account.get("charges_enabled"))
    payouts_enabled = bool(account.get("payouts_enabled"))
    await vendor_payouts.save_stripe_account(session, vendor_user_id, account_id)
    await vendor_payouts.save_stripe_flags(
        session, vendor_user_id, charges_enabled=charges_enabled, payouts_enabled=payouts_enabled
    )
    state = ConnectState(
        stripe_account_id=account_id, charges_enabled=charges_enabled, payouts_enabled=payouts_enabled
    )
    return state, transfer_id


async def restore_connect_from_payout_history(
    session: AsyncSession, gateway: PaymentGateway, *, vendor_user_id: str, actor: Principal
) -> AdminVendorRestoreStripeConnectResponse:
    """Super admin: point the vendor back at the Connect account their latest payout went to.

    Used when a vendor's stored account id was lost (e.g. cleared as orphaned) although
    Stripe still pays out through it. Only reads Stripe, so no idempotency key is needed.
    The baseline answers 400 for its own refusals and 502 for anything else.
    """
    if not gateway.is_configured():
        raise StripeNotConfigured()
    try:
        state, transfer_id = await _restore_connect_state(session, gateway, vendor_user_id)
    except (PayoutTransferNotFound, ConnectAccountResolveFailed):
        raise
    except Exception as error:
        log.warning(
            "payments: restore-stripe-connect failed vendor=%s: %s", vendor_user_id, error, exc_info=True
        )
        raise StripeConnectRestoreFailed() from error
    log.info(
        "payments: restored Stripe Connect vendor=%s account=%s from transfer=%s",
        vendor_user_id,
        state.stripe_account_id,
        transfer_id,
    )
    await staff.record_admin_action(
        session,
        admin_user_id=actor.id,
        action="vendor.stripe_connect_restored",
        entity_type="vendor",
        entity_id=vendor_user_id,
        details={"stripe_account_id": state.stripe_account_id, "restored_from_transfer_id": transfer_id},
    )
    return AdminVendorRestoreStripeConnectResponse(
        user_id=vendor_user_id,
        stripe_account_id=state.stripe_account_id,
        stripe_charges_enabled=state.charges_enabled,
        stripe_payouts_enabled=state.payouts_enabled,
        restored_from_transfer_id=transfer_id,
    )


async def payout_history(
    session: AsyncSession, vendor_user_id: str, *, offset: int = 0, limit: int = DEFAULT_LIST_LIMIT
) -> VendorPayoutHistoryResponse:
    """The vendor's payout ledger: their share only, never the client total."""
    ledger = await service_payout_ledger.vendor_payout_ledger(session, vendor_user_id)
    payouts = ledger.payouts
    page = payouts[offset : offset + limit]
    return VendorPayoutHistoryResponse(
        **ledger.model_dump(exclude={"payouts"}),
        payouts=page,
        total=len(payouts),
        offset=offset,
        limit=limit,
    )


# --- the webhook ---------------------------------------------------------------------------------------


def verified_event(payload: bytes, signature_header: str | None) -> dict[str, Any]:
    """The event Stripe signed, or the 400 the baseline answers for a missing or bad signature."""
    if not signature_header:
        raise MissingStripeSignature()
    secret = get_settings().stripe_webhook_secret
    if not domain.webhook_signature_is_valid(payload, signature_header, secret, now_seconds=int(time.time())):
        log.warning(
            "payments: webhook signature verification failed (check STRIPE_WEBHOOK_SECRET matches "
            "this endpoint's signing secret, and test vs live mode)"
        )
        raise InvalidStripeSignature()
    event = domain.parse_webhook_event(payload)
    if event is None:
        log.warning("payments: signed webhook body is not a JSON object")
        raise InvalidStripeSignature()
    return event


async def _dispatch(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    event_type: str,
    event_object: dict[str, Any],
) -> None:
    """Hand a new event to the flow it belongs to."""
    if event_type == CHECKOUT_COMPLETED:
        await service_payments_checkout.finalize_checkout_session(session, mailer, gateway, event_object)
    elif event_type == ACCOUNT_UPDATED:
        account_id = str(event_object.get("id") or "")
        if not account_id:
            return
        vendor_user_id = await vendor_payouts.vendor_for_stripe_account(session, account_id)
        if vendor_user_id is not None:
            await sync_connect_account(session, gateway, vendor_user_id)
    elif event_type == CHARGE_DISPUTE_CREATED:
        await service_payments.hold_for_chargeback(
            session,
            mailer,
            charge_id=str(event_object.get("charge") or ""),
            dispute_id=str(event_object.get("id") or ""),
            amount_pence=int(event_object.get("amount") or 0),
            reason=event_object.get("reason"),
        )
    elif event_type == CHARGE_DISPUTE_CLOSED:
        await service_payments.settle_chargeback(
            session,
            mailer,
            charge_id=str(event_object.get("charge") or ""),
            dispute_id=str(event_object.get("id") or ""),
            amount_pence=int(event_object.get("amount") or 0),
            outcome=str(event_object.get("status") or ""),
        )
    elif event_type == CHARGE_REFUNDED:
        await service_payments.reconcile_external_refund(
            session,
            mailer,
            charge_id=str(event_object.get("id") or ""),
            amount_pence=int(event_object.get("amount") or 0),
            amount_refunded_pence=int(event_object.get("amount_refunded") or 0),
        )


async def handle_webhook(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    payload: bytes,
    signature_header: str | None,
) -> None:
    """Verify, deduplicate and act on one Stripe webhook delivery.

    The event id is claimed first, in the same transaction as the handler's writes, so
    a redelivery of a handled event is a no-op. A handler that fails raises
    `StripeWebhookHandlerFailed` (a 503): the request's transaction rolls back, claim
    included, and Stripe redelivers the event, so a transient failure (a database blip,
    a lost connection) does not leave a paid booking `pending` until someone syncs it.
    Handlers use conditional writes, so a retry after a partial success changes nothing twice.
    """
    event = verified_event(payload, signature_header)
    event_id = str(event.get("id") or "")
    event_type = str(event.get("type") or "")
    if event_type not in HANDLED_EVENT_TYPES:
        log.debug("payments: unhandled Stripe webhook type=%s id=%s", event_type, event_id)
        return
    if not await repository.claim_webhook_event(session, event_id, event_type):
        log.info("payments: Stripe webhook already processed id=%s type=%s", event_id, event_type)
        return
    try:
        await _dispatch(session, mailer, gateway, event_type, domain.webhook_event_object(event))
    except Exception as handler_error:
        log.exception("payments: Stripe webhook handler failed type=%s id=%s", event_type, event_id)
        raise StripeWebhookHandlerFailed() from handler_error
