"""Money leaving Eventtz for a paid booking: refunds to the client and the payout Transfer to the vendor.

Checkout pays Eventtz; the vendor is paid later by an explicit Stripe Transfer
(AGENTS.md "held funds"), which is what lets a cancel refund in full and a dispute
block the payout. Stripe is always called first and the booking written after,
each write conditional on the `payment_status` read, so a retry or a race never
moves money twice: every Refund and Transfer also carries an idempotency key.

`refund_booking_for_staff` and `release_payout_for_staff` are the contract the
disputes slice and the admin recovery routes call.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway, PaymentGatewayError, PaymentsUnavailable
from app.features.bookings import domain, domain_payments, repository
from app.features.bookings.errors import (
    BookingNotFound,
    NoPaymentOnRecord,
    OnlyPaidCanRefund,
    OnlyPaidPayoutRelease,
    PayoutAmountMissing,
    PayoutReleaseFailed,
    RefundFailed,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas import ConfirmCompletionResponse
from app.features.bookings.service_common import announce_change
from app.features.marketplace import service_events as events
from app.features.notifications import service_booking as notices
from app.features.notifications.service_payment_alerts import (
    send_payout_stuck_alert,
    send_refund_failed_alert,
)
from app.features.vendors import service_payouts as vendor_payouts

log = get_logger(__name__)

# Stripe error text can be long; the ops alert keeps the start of it, as the baseline did.
_ERROR_HINT_LIMIT = 500

STAFF_REFUND_BODY = (
    "Your payment for this booking was refunded.\n\n"
    "It should reach your card within 5-10 working days, depending on your bank."
)
CANCEL_REFUND_BODY = (
    "This booking was cancelled. Your payment has been refunded in full.\n\n"
    "It should reach your card within 5-10 working days, depending on your bank."
)
_PAYOUT_HELD_BODY = (
    "Both of you confirmed the event is complete. We are holding your payout until you finish "
    "Stripe payout setup.\n\nOpen Payouts to complete verification so we can send your funds."
)
_PAYOUT_RELEASED_BODY = (
    "Your payout for this booking has been released.\n\n"
    "It should arrive in your connected account shortly, depending on your bank. "
    "Thank you for completing this booking with Eventtz."
)


def _completion_state(booking: BookingRow) -> ConfirmCompletionResponse:
    """The confirm-completion response for the booking as stored."""
    return ConfirmCompletionResponse.model_validate(domain.completion_result(booking))


async def _load_booking(session: AsyncSession, booking_id: str) -> BookingRow:
    """The whole booking row (list views omit the money columns), or `BookingNotFound`."""
    booking = await repository.get_booking(session, booking_id)
    if booking is None:
        raise BookingNotFound()
    return booking


# --- refunds -----------------------------------------------------------------------------------------


async def _refund_paid_booking(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    booking: BookingRow,
    *,
    amount_pence: int | None,
    idempotency_suffix: str,
    refund_body: str,
) -> BookingRow:
    """Refund a paid booking in Stripe (in full when `amount_pence` is None), then record it.

    Raises before anything is written when the refund fails, so a caller about to
    cancel leaves the booking as it was; staff are emailed the Stripe error.
    """
    if booking.payment_status != domain_payments.PAID:
        raise OnlyPaidCanRefund()
    payment_intent_id = booking.stripe_payment_intent_id
    if not payment_intent_id:
        raise NoPaymentOnRecord()
    try:
        await gateway.create_refund(
            payment_intent_id=payment_intent_id,
            amount_pence=amount_pence,
            metadata={"booking_id": booking.id},
            idempotency_key=domain_payments.refund_idempotency_key(booking.id, idempotency_suffix),
        )
    except (PaymentGatewayError, PaymentsUnavailable) as refund_error:
        log.exception("bookings: stripe refund failed booking=%s", booking.id)
        send_refund_failed_alert(
            mailer, booking_id=booking.id, error_hint=str(refund_error)[:_ERROR_HINT_LIMIT]
        )
        raise RefundFailed() from refund_error

    new_payment_status = (
        domain_payments.REFUNDED if amount_pence is None else domain_payments.PARTIALLY_REFUNDED
    )
    await repository.update_booking(
        session,
        booking.id,
        {"payment_status": new_payment_status},
        payment_status_in=(domain_payments.PAID,),
    )
    # The first refund's time is kept, as the baseline's funnel timestamp was.
    await repository.update_booking(
        session, booking.id, {}, unset_column="refunded_at", now_columns=("refunded_at",)
    )
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="payment_refunded",
        body=refund_body,
    )
    announce_change(session, booking)
    return await _load_booking(session, booking.id)


async def refund_booking_for_staff(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    booking_id: str,
    amount_pence: int | None,
) -> BookingRow:
    """A staff refund (a dispute resolution): in full when `amount_pence` is None, else that part."""
    booking = await _load_booking(session, booking_id)
    return await _refund_paid_booking(
        session,
        mailer,
        gateway,
        booking,
        amount_pence=amount_pence,
        idempotency_suffix="full" if amount_pence is None else "partial",
        refund_body=STAFF_REFUND_BODY,
    )


async def prepare_cancel(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    booking: BookingRow,
    *,
    cancelled_by: str,
) -> bool:
    """Settle the money before a booking is cancelled; True when a paid booking was refunded in full.

    A checkout still open is closed (best effort) so the cancelled booking cannot be
    paid. A paid booking is refunded first; if that fails the error stops the cancel.
    """
    if booking.payment_status == "pending":
        await _expire_checkout_session(gateway, booking.stripe_checkout_session_id)
        return False
    if booking.payment_status != domain_payments.PAID:
        return False
    await _refund_paid_booking(
        session,
        mailer,
        gateway,
        booking,
        amount_pence=None,
        idempotency_suffix=f"cancel-{cancelled_by}",
        refund_body=CANCEL_REFUND_BODY,
    )
    return True


async def _expire_checkout_session(gateway: PaymentGateway, checkout_session_id: str | None) -> None:
    """Close an open Checkout Session; a session already gone, or Stripe being down, is only logged."""
    session_id = (checkout_session_id or "").strip()
    if not session_id.startswith("cs_"):
        return
    try:
        await gateway.expire_checkout_session(session_id)
    except (PaymentGatewayError, PaymentsUnavailable) as expire_error:
        log.info("bookings: checkout session expire skipped session=%s: %s", session_id, expire_error)


# --- payout ------------------------------------------------------------------------------------------


async def _source_charge_id(gateway: PaymentGateway, booking: BookingRow) -> str | None:
    """The client's charge to fund the Transfer from, so it works even once the balance was paid out.

    Without it Stripe draws on the platform's available balance, which automatic
    payouts may already have emptied; a failed lookup is only logged.
    """
    charge_id = domain_payments.usable_charge_id(booking.stripe_charge_id)
    if charge_id:
        return charge_id
    payment_intent_id = domain_payments.usable_payment_intent_id(booking.stripe_payment_intent_id)
    if not payment_intent_id:
        return None
    try:
        payment_intent = await gateway.retrieve_payment_intent(payment_intent_id)
    except (PaymentGatewayError, PaymentsUnavailable):
        log.exception("bookings: could not resolve the charge of payment intent %s", payment_intent_id)
        return None
    return domain_payments.charge_id_from_payment_intent(payment_intent)


async def _existing_transfer_id(gateway: PaymentGateway, booking_id: str) -> str | None:
    """A Transfer already made for this booking, found by its transfer group; None when none or unknown."""
    try:
        transfer_ids = await gateway.list_transfer_ids(domain_payments.transfer_group(booking_id))
    except (PaymentGatewayError, PaymentsUnavailable):
        log.exception("bookings: list transfers failed booking=%s", booking_id)
        return None
    return transfer_ids[0] if transfer_ids else None


async def _transfer_vendor_share(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    booking: BookingRow,
    *,
    destination_account_id: str,
    amount_pence: int,
) -> str:
    """The id of the Transfer paying the vendor's share: an earlier one for this booking, else a new one."""
    existing_transfer_id = await _existing_transfer_id(gateway, booking.id)
    if existing_transfer_id:
        log.info("bookings: reclaiming transfer=%s booking=%s", existing_transfer_id, booking.id)
        return existing_transfer_id
    source_charge_id = await _source_charge_id(gateway, booking)
    if not source_charge_id:
        log.warning("bookings: no charge to fund the payout of booking=%s; using the balance", booking.id)
    try:
        return await gateway.create_transfer(
            amount_pence=amount_pence,
            destination_account_id=destination_account_id,
            transfer_group=domain_payments.transfer_group(booking.id),
            metadata={"booking_id": booking.id},
            source_charge_id=source_charge_id,
            idempotency_key=domain_payments.transfer_idempotency_key(
                booking_id=booking.id,
                amount_pence=amount_pence,
                destination_account_id=destination_account_id,
                source_charge_id=source_charge_id,
            ),
        )
    except (PaymentGatewayError, PaymentsUnavailable) as transfer_error:
        # A clash with an earlier attempt's key means that attempt may have paid already.
        reclaimed_transfer_id = await _existing_transfer_id(gateway, booking.id)
        if reclaimed_transfer_id:
            return reclaimed_transfer_id
        log.exception("bookings: stripe transfer failed booking=%s", booking.id)
        await send_payout_stuck_alert(
            session,
            mailer,
            booking_id=booking.id,
            vendor_user_id=booking.vendor_user_id,
            error_hint=str(transfer_error)[:_ERROR_HINT_LIMIT],
        )
        raise PayoutReleaseFailed() from transfer_error


async def _announce_payout(
    session: AsyncSession, mailer: Mailer, booking: BookingRow, *, amount_pence: int
) -> None:
    """Record the completed booking and tell both parties the vendor has been paid."""
    booking_value_gbp = booking.payment_amount_gbp or domain_payments.pence_to_gbp(amount_pence)
    await events.record_marketplace_event(
        session,
        "booking_completed",
        vendor_user_id=booking.vendor_user_id,
        booking_request_id=booking.id,
        booking_value_gbp=float(booking_value_gbp),
    )
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="booking_completed",
        mode="insert_if_absent",
    )
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking.id,
        kind="vendor_payout_released",
        body=_PAYOUT_RELEASED_BODY,
        send_email=False,
    )
    announce_change(session, booking)


async def release_vendor_payout(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, *, booking_id: str
) -> ConfirmCompletionResponse:
    """Pay the vendor their share by Transfer, then mark the booking completed and paid out.

    A vendor Stripe cannot pay yet is told the payout is held and the booking stays
    paid. The final write is conditional on accepted + paid, so a second caller that
    lost the race returns the stored state instead of notifying twice.
    """
    booking = await _load_booking(session, booking_id)
    vendor = await vendor_payouts.vendor_for_payouts(session, booking.vendor_user_id)
    destination_account_id = vendor.stripe_account_id if vendor is not None else None
    if not destination_account_id or not (vendor is not None and vendor.stripe_payouts_enabled):
        log.warning("bookings: payout held booking=%s: vendor Stripe payouts not enabled", booking.id)
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.vendor_user_id,
            booking_id=booking.id,
            kind="payout_held_connect_incomplete",
            mode="insert_if_absent",
            body=_PAYOUT_HELD_BODY,
        )
        announce_change(session, booking)
        return _completion_state(booking)

    amount_pence = domain_payments.gbp_to_pence(booking.vendor_amount_gbp or 0.0)
    if amount_pence <= 0:
        hint = (
            f"vendor_amount_gbp is missing or zero (raw={booking.vendor_amount_gbp!r}); "
            "cannot create a Stripe Transfer."
        )
        log.error("bookings: cannot release payout booking=%s: %s", booking.id, hint)
        await send_payout_stuck_alert(
            session, mailer, booking_id=booking.id, vendor_user_id=booking.vendor_user_id, error_hint=hint
        )
        raise PayoutAmountMissing()

    transfer_id = await _transfer_vendor_share(
        session,
        mailer,
        gateway,
        booking,
        destination_account_id=destination_account_id,
        amount_pence=amount_pence,
    )
    released = await repository.update_booking(
        session,
        booking.id,
        {
            "status": "completed",
            "payment_status": domain_payments.PAYOUT_RELEASED,
            "stripe_transfer_id": transfer_id,
        },
        status_in=("accepted",),
        payment_status_in=(domain_payments.PAID,),
        now_columns=("payout_released_at", "completed_at"),
    )
    stored = await _load_booking(session, booking.id)
    if not released:
        if stored.payment_status != domain_payments.PAYOUT_RELEASED:
            log.error(
                "bookings: transfer=%s made but booking=%s not updated status=%s payment=%s",
                transfer_id,
                booking.id,
                stored.status,
                stored.payment_status,
            )
        return _completion_state(stored)
    await _announce_payout(session, mailer, stored, amount_pence=amount_pence)
    return _completion_state(stored)


async def release_payout_for_staff(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, *, booking_id: str
) -> ConfirmCompletionResponse:
    """A staff payout (a dispute resolution or recovery): pay the vendor without both confirmations."""
    booking = await _load_booking(session, booking_id)
    if booking.payment_status != domain_payments.PAID:
        raise OnlyPaidPayoutRelease()
    return await release_vendor_payout(session, mailer, gateway, booking_id=booking.id)
