"""Super-admin tools to unstick a booking: re-check a payment, pay the vendor, finish or force a cancel,
confirm completion for a party, and run the post-event step now.

Ported from the baseline's `admin/booking_recovery.py`. Each tool refuses a booking in
the wrong state with a 400 naming why, records a `booking.<tool>` entry in the admin
audit log once it has worked, and answers with the admin detail view of the booking.

Money moves through `service_payments` (refunds and Transfers carry idempotency keys),
so pressing a tool twice never pays or refunds twice.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway, PaymentGatewayError
from app.core.settings import get_settings
from app.features.bookings import (
    domain,
    domain_maintenance,
    domain_payments,
    repository,
    service_admin,
    service_maintenance,
    service_payments,
    service_payments_checkout,
)
from app.features.bookings.errors import (
    CancelOnlyPendingOrAccepted,
    CompleteOnlyAccepted,
    RecoveryBookingNotFound,
    RecoveryCheckoutSessionNotFound,
    RecoveryCouldNotCancel,
    RecoveryCouldNotCompleteCancellation,
    RecoveryDisputeBlocksPayout,
    RecoveryMarkPaidFailed,
    RecoveryNotAcceptedRefunded,
    RecoveryNothingToSync,
    RecoveryOnlyAcceptedMarkPaid,
    RecoveryOnlyPaidPayoutRelease,
    RecoveryOnlyRefundedCompleteCancel,
    RecoveryPaymentIntentMismatch,
    RecoveryPaymentIntentNoAmount,
    RecoveryPaymentIntentNotSucceeded,
    RecoveryPaymentRequiredMarkComplete,
    RecoveryPayoutNeedsAccepted,
    RecoveryPayoutNotEligible,
    RecoveryPayoutNotReleased,
    RecoveryReasonRequired,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas import AdminBookingDetailResponse
from app.features.bookings.service_common import announce_change, check_may_cancel, require_booking_id
from app.features.staff import service as staff_service

log = get_logger(__name__)

Party = Literal["client", "vendor"]

# Payment intent states that mean the client's money was taken (or is authorised to be).
_PAID_INTENT_STATUSES = ("succeeded", "requires_capture")


async def _load(session: AsyncSession, booking_id: str) -> BookingRow:
    """The booking named in the path: 400 "Invalid booking id." / "Booking not found." as the baseline."""
    booking = await repository.get_booking(session, require_booking_id(booking_id))
    if booking is None:
        raise RecoveryBookingNotFound()
    return booking


async def _audited_detail(
    session: AsyncSession,
    staff: Principal,
    booking_id: str,
    *,
    action: str,
    details: dict[str, Any] | None = None,
) -> AdminBookingDetailResponse:
    """Record the tool in the admin audit log, then answer with the booking as stored now."""
    await staff_service.record_admin_action(
        session,
        admin_user_id=staff.id,
        action=action,
        entity_type="booking_request",
        entity_id=booking_id,
        details=details or {},
    )
    booking = await _load(session, booking_id)
    # ws2 owns `service_admin`; `_to_admin_detail` is the one builder of the admin view.
    detail = await service_admin._to_admin_detail(session, booking)
    return AdminBookingDetailResponse(success=True, booking=detail)


# --- sync payment ------------------------------------------------------------------------------------


async def _mark_paid_from_payment_intent(
    session: AsyncSession, gateway: PaymentGateway, booking: BookingRow, payment_intent: dict[str, Any]
) -> bool:
    """Mark the booking paid from a succeeded payment intent; True when the write matched."""
    if str(payment_intent.get("status") or "").lower() not in _PAID_INTENT_STATUSES:
        raise RecoveryPaymentIntentNotSucceeded()
    metadata = payment_intent.get("metadata") or {}
    metadata_booking_id = str(metadata.get("booking_id") or "").strip()
    if metadata_booking_id and metadata_booking_id != booking.id:
        raise RecoveryPaymentIntentMismatch()
    amount_pence = payment_intent.get("amount_received") or payment_intent.get("amount")
    if not isinstance(amount_pence, int | float) or amount_pence <= 0:
        raise RecoveryPaymentIntentNoAmount()
    charge_fields = await service_payments_checkout._charge_fields(
        gateway, {"payment_intent": payment_intent}
    )
    return await repository.update_booking(
        session,
        booking.id,
        {
            "payment_status": domain_payments.PAID,
            "stripe_payment_intent_id": str(payment_intent.get("id") or "").strip(),
            "stripe_charge_id": charge_fields["stripe_charge_id"],
            "stripe_receipt_url": charge_fields["stripe_receipt_url"],
            "payment_amount_gbp": domain_payments.pence_to_gbp(int(amount_pence)),
            "vendor_amount_gbp": domain_payments.metadata_amount_gbp(metadata, "vendor_amount_gbp"),
            "platform_fee_gbp": domain_payments.metadata_amount_gbp(metadata, "service_fee_gbp"),
        },
        status_in=("accepted",),
        payment_status_in=domain_payments.PAYABLE_PAYMENT_STATUSES,
        now_columns=("paid_at",),
    )


async def _sync_from_checkout_session(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    booking: BookingRow,
    checkout_session_id: str,
) -> bool:
    """Finalize a paid Checkout Session; True once the booking is paid. A vanished session is cleared."""
    try:
        checkout_session = await gateway.retrieve_checkout_session(checkout_session_id)
    except PaymentGatewayError as error:
        if not domain_payments.is_missing_checkout_session(error.stripe_code, str(error)):
            raise
        # The client can start a fresh checkout; the cleared session is kept (persist_effects).
        await repository.update_booking(
            session,
            booking.id,
            {"stripe_checkout_session_id": None, "payment_status": "unpaid"},
            payment_status_in=domain_payments.PAYABLE_PAYMENT_STATUSES,
        )
        raise RecoveryCheckoutSessionNotFound() from error
    if str(checkout_session.get("payment_status") or "") != "paid":
        return False
    await service_payments_checkout.finalize_checkout_session(session, mailer, gateway, checkout_session)
    refreshed = await _load(session, booking.id)
    return refreshed.payment_status in domain_payments.PAID_PAYMENT_STATUSES


async def sync_payment(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, staff: Principal, booking_id: str
) -> AdminBookingDetailResponse:
    """Ask Stripe whether an accepted booking was paid and mark it paid when it was.

    For a client charged whose webhook never arrived. The Checkout Session is tried
    first, then the stored payment intent. A settled booking is left as it is.
    """
    booking = await _load(session, booking_id)
    if booking.payment_status not in domain_payments.SETTLED_PAYMENT_STATUSES:
        await _sync_unsettled(session, mailer, gateway, booking)
    return await _audited_detail(session, staff, booking.id, action="booking.sync_payment")


async def _sync_unsettled(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow
) -> None:
    """The sync for a booking not yet paid: Checkout Session first, then the payment intent."""
    if booking.status != "accepted":
        raise RecoveryOnlyAcceptedMarkPaid()
    checkout_session_id = (booking.stripe_checkout_session_id or "").strip()
    if checkout_session_id and await _sync_from_checkout_session(
        session, mailer, gateway, booking, checkout_session_id
    ):
        return
    payment_intent_id = (booking.stripe_payment_intent_id or "").strip()
    if not payment_intent_id:
        raise RecoveryNothingToSync()
    payment_intent = await gateway.retrieve_payment_intent(payment_intent_id)
    if not await _mark_paid_from_payment_intent(session, gateway, booking, payment_intent):
        raise RecoveryMarkPaidFailed()
    # Payment receipts are not rebuilt yet (as for checkout); both screens refresh.
    announce_change(session, booking)


# --- payout ------------------------------------------------------------------------------------------


async def release_payout(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    staff: Principal,
    booking_id: str,
    *,
    action: str = "booking.release_payout",
) -> AdminBookingDetailResponse:
    """Pay the vendor of a paid booking once both confirmed or the automatic payout date has passed.

    `release-payout` and `retry-payout` are the same tool (the baseline's too); only the
    audit action differs. An open dispute blocks it.
    """
    booking = await _load(session, booking_id)
    if booking.payment_status != domain_payments.PAID:
        raise RecoveryOnlyPaidPayoutRelease()
    if booking.status != "accepted":
        raise RecoveryPayoutNeedsAccepted()
    if await repository.has_active_dispute(session, booking.id):
        raise RecoveryDisputeBlocksPayout()
    hours_after_event = get_settings().booking_payout_auto_release_hours_after_event
    if not domain_maintenance.payout_eligible_for_staff(
        booking, datetime.now(UTC), hours_after_event=hours_after_event
    ):
        raise RecoveryPayoutNotEligible()
    result = await service_payments.release_vendor_payout(session, mailer, gateway, booking_id=booking.id)
    if result.payment_status != domain_payments.PAYOUT_RELEASED:
        # The vendor cannot be paid yet (Stripe setup unfinished); their notice is kept.
        raise RecoveryPayoutNotReleased()
    return await _audited_detail(session, staff, booking.id, action=action)


# --- cancellation ------------------------------------------------------------------------------------


async def _complete_refunded_cancellation(session: AsyncSession, booking: BookingRow) -> None:
    """Flip an accepted booking whose payment was already refunded to cancelled."""
    if booking.payment_status != domain_payments.REFUNDED:
        raise RecoveryOnlyRefundedCompleteCancel()
    if booking.status != "accepted":
        raise RecoveryNotAcceptedRefunded()
    cancelled_by = booking.cancelled_by if booking.cancelled_by in ("client", "vendor") else "client"
    cancelled = await repository.update_booking(
        session,
        booking.id,
        {"status": "cancelled", "cancelled_by": cancelled_by},
        status_in=("accepted",),
        payment_status_in=(domain_payments.REFUNDED,),
        now_columns=("cancelled_at",),
    )
    if not cancelled:
        raise RecoveryCouldNotCompleteCancellation()
    announce_change(session, booking)


async def complete_cancellation(
    session: AsyncSession, staff: Principal, booking_id: str
) -> AdminBookingDetailResponse:
    """Finish a cancel whose refund went through but whose status stayed accepted."""
    booking = await _load(session, booking_id)
    await _complete_refunded_cancellation(session, booking)
    return await _audited_detail(session, staff, booking.id, action="booking.complete_cancellation")


async def cancel_on_behalf(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    staff: Principal,
    booking_id: str,
    *,
    party: Party,
    reason: str,
) -> AdminBookingDetailResponse:
    """Cancel a pending or accepted booking as the client or vendor asked support to, refunding a paid one.

    The same money rules as a party's own cancel apply (no cancel after payout or with
    an open dispute). The reason is kept in the audit log only; nobody is emailed, as
    in the baseline.
    """
    stripped_reason = reason.strip()
    if not stripped_reason:
        raise RecoveryReasonRequired()
    booking = await _load(session, booking_id)
    if booking.status == "completed":
        domain.check_cancel_money_state(status=booking.status, payment_status=booking.payment_status)
    if booking.status not in ("pending", "accepted"):
        raise CancelOnlyPendingOrAccepted()
    await check_may_cancel(session, booking)
    details = {"party": party, "reason": stripped_reason}
    if booking.payment_status == domain_payments.PAID:
        await service_payments.prepare_cancel(session, mailer, gateway, booking, cancelled_by=party)
    elif booking.payment_status == domain_payments.REFUNDED and booking.status == "accepted":
        await _complete_refunded_cancellation(session, booking)
        return await _audited_detail(
            session, staff, booking.id, action="booking.cancel_on_behalf", details=details
        )
    cancelled = await repository.update_booking(
        session,
        booking.id,
        {"status": "cancelled", "cancelled_by": party},
        status_in=("pending", "accepted"),
        now_columns=("cancelled_at",),
    )
    if not cancelled:
        # A refund already made stays recorded (persist_effects).
        raise RecoveryCouldNotCancel()
    announce_change(session, booking)
    return await _audited_detail(
        session, staff, booking.id, action="booking.cancel_on_behalf", details=details
    )


# --- completion and maintenance ----------------------------------------------------------------------


async def _confirm_for_party(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow, party: Party
) -> None:
    """Stamp the party's confirmation (once), then pay out if both have, else run the post-event step."""
    confirmed_column = f"{party}_completion_confirmed_at"
    already_confirmed = bool(getattr(booking, confirmed_column))
    if not already_confirmed:
        # Support may confirm before the event day is over: they have spoken to the party.
        await repository.update_booking(
            session, booking.id, {}, unset_column=confirmed_column, now_columns=(confirmed_column,)
        )
        announce_change(session, booking)
    confirmed = await _load(session, booking.id)
    if confirmed.client_completion_confirmed_at and confirmed.vendor_completion_confirmed_at:
        await service_payments.release_vendor_payout(session, mailer, gateway, booking_id=confirmed.id)
    elif not already_confirmed:
        await service_maintenance.run_post_event_step(session, mailer, gateway, confirmed)


async def confirm_completion(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    staff: Principal,
    booking_id: str,
    *,
    party: Party,
) -> AdminBookingDetailResponse:
    """Confirm the event went ahead on a party's behalf; the vendor is paid once both have confirmed."""
    booking = await _load(session, booking_id)
    if booking.status != "accepted":
        raise CompleteOnlyAccepted()
    if booking.payment_status != domain_payments.PAID:
        raise RecoveryPaymentRequiredMarkComplete()
    await _confirm_for_party(session, mailer, gateway, booking, party)
    return await _audited_detail(
        session, staff, booking.id, action="booking.confirm_completion", details={"party": party}
    )


async def run_maintenance(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, staff: Principal, booking_id: str
) -> AdminBookingDetailResponse:
    """Run the hourly post-event step for one booking now: completion reminder, then any payout due."""
    booking = await _load(session, booking_id)
    await service_maintenance.run_post_event_step(session, mailer, gateway, booking)
    return await _audited_detail(session, staff, booking.id, action="booking.run_maintenance")
