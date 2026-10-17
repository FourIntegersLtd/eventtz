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

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway, PaymentGatewayError, PaymentsUnavailable
from app.features.bookings import (
    domain,
    domain_cancellation,
    domain_payments,
    domain_policy,
    repository,
    repository_admin,
    service_receipts,
)
from app.features.bookings.errors import (
    BookingNotFound,
    NoPaymentOnRecord,
    OnlyPaidCanRefund,
    OnlyPaidPayoutRelease,
    PartialRefundTooLarge,
    PayoutAmountMissing,
    PayoutReleaseFailed,
    RefundFailed,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas import ConfirmCompletionResponse
from app.features.bookings.service_common import announce_change
from app.features.bookings.service_payments_checkout import expire_checkout_session
from app.features.marketplace import service_events as events
from app.features.notifications import service_booking as notices
from app.features.notifications.service_payment_alerts import (
    send_chargeback_alert,
    send_external_refund_alert,
    send_payout_stuck_alert,
    send_refund_failed_alert,
)
from app.features.pricing import service as pricing
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
_CANCELLATION_SHARE_HELD_BODY = (
    "The client cancelled this booking and your cancellation policy leaves you a share of their "
    "payment. We are holding it until you finish Stripe payout setup.\n\n"
    "Open Payouts to complete verification so we can send your funds."
)
_CANCELLATION_SHARE_PAID_BODY = (
    "The client cancelled this booking. Under your cancellation policy, your share of their payment "
    "has been sent to your connected account.\n\nIt should arrive shortly, depending on your bank."
)
# The same two notices for a staff partial refund (a dispute resolution), where no policy applied.
_STAFF_SPLIT_SHARE_HELD_BODY = (
    "Part of the client's payment for this booking was refunded by Eventtz support, and the rest "
    "of your price is yours. We are holding it until you finish Stripe payout setup.\n\n"
    "Open Payouts to complete verification so we can send your funds."
)
_STAFF_SPLIT_SHARE_PAID_BODY = (
    "Part of the client's payment for this booking was refunded by Eventtz support. The rest of "
    "your price has been sent to your connected account.\n\nIt should arrive shortly, depending on your bank."
)


@dataclass(frozen=True)
class CancelSettlement:
    """What `prepare_cancel` did with a booking's money, for the callers' notices and responses."""

    refunded: bool
    refund_percent: int | None = None
    refund_gbp: float | None = None
    vendor_share_gbp: float | None = None
    vendor_share_paid: bool = False

    @property
    def partial(self) -> bool:
        """True when the client got only part of their payment back."""
        return self.refunded and self.refund_percent is not None and self.refund_percent < 100


def tiered_refund_body(settlement: domain_cancellation.CancellationSettlement, paid_gbp: float) -> str:
    """The client's refund notice for a tiered cancel: how much, and which policy decided it."""
    refund_label = pricing.format_gbp(domain_payments.pence_to_gbp(settlement.refund_pence))
    paid_label = pricing.format_gbp(paid_gbp)
    policy_label = domain_cancellation.preset_label(settlement.policy)
    return (
        f"This booking was cancelled. Under the vendor's {policy_label} cancellation policy, "
        f"{refund_label} of your {paid_label} payment has been refunded "
        f"({settlement.refund_percent}% of the vendor's price plus the full Eventtz service fee).\n\n"
        "It should reach your card within 5-10 working days, depending on your bank."
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


async def lock_and_load_booking(session: AsyncSession, booking_id: str) -> BookingRow:
    """Lock the booking row for this transaction, then read it fresh (every money path starts here)."""
    await repository.lock_booking(session, booking_id)
    return await _load_booking(session, booking_id)


async def _reconcile_upfront_transfer(
    session: AsyncSession, gateway: PaymentGateway, booking: BookingRow
) -> BookingRow:
    """Record a split's first-part Transfer that Stripe has but the row does not; the row as it is now.

    A first-part Transfer whose database write was then rolled back (a failed commit, a crash)
    leaves `upfront_payout_at` empty, and the payout and refund paths would treat that money as
    still held. Its amount is fixed by the checkout snapshot, so it can be recorded exactly.
    """
    if (
        not booking.payout_upfront_percent
        or booking.upfront_payout_at
        or booking.payment_status != domain_payments.PAID
    ):
        return booking
    upfront_transfer_id = await _existing_transfer_id(gateway, booking.id, "upfront")
    if not upfront_transfer_id:
        return booking
    log.warning(
        "bookings: recording unrecorded upfront transfer=%s booking=%s", upfront_transfer_id, booking.id
    )
    await _record_stage_payout(
        session,
        booking,
        stage="upfront",
        transfer_id=upfront_transfer_id,
        amount_pence=_stage_amount_pence(booking, "upfront"),
    )
    return await _load_booking(session, booking.id)


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
    includes_deposit: bool = False,
    full_refund: bool | None = None,
) -> BookingRow:
    """Refund a paid booking in Stripe (in full when `amount_pence` is None), then record it.

    Raises before anything is written when the refund fails, so a caller about to
    cancel leaves the booking as it was; staff are emailed the Stripe error.
    `includes_deposit` says the refund carried the client's damage deposit back too,
    so the deposit is stamped as returned and never refunded a second time.
    `full_refund` overrides the status written (a "full" refund that had to leave
    out an upfront payout already sent is still everything the client can get back).
    """
    # Re-read under the row lock: a payout or another refund may have moved the money meanwhile.
    booking = await lock_and_load_booking(session, booking.id)
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

    is_full = amount_pence is None if full_refund is None else full_refund
    new_payment_status = domain_payments.REFUNDED if is_full else domain_payments.PARTIALLY_REFUNDED
    status_written = await repository.update_booking(
        session,
        booking.id,
        {"payment_status": new_payment_status},
        payment_status_in=(domain_payments.PAID,),
    )
    if not status_written:
        # Cannot happen under the row lock; if it does, money moved and the row disagrees.
        log.error("bookings: refund made but payment_status not written booking=%s", booking.id)
        send_refund_failed_alert(
            mailer, booking_id=booking.id, error_hint="Refund sent, but the booking's payment status changed."
        )
    # The first refund's time is kept, as the baseline's funnel timestamp was.
    await repository.update_booking(
        session, booking.id, {}, unset_column="refunded_at", now_columns=("refunded_at",)
    )
    if includes_deposit and domain_policy.deposit_still_held(booking):
        await repository.update_booking(
            session, booking.id, {}, unset_column="deposit_refunded_at", now_columns=("deposit_refunded_at",)
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


# --- money moved outside the app: chargebacks and dashboard refunds ----------------------------------


def _pence_label(amount_pence: int) -> str:
    """`GBP 157.50` for 15750 pence, for ops emails."""
    return f"GBP {amount_pence / 100:.2f}"


async def hold_for_chargeback(
    session: AsyncSession,
    mailer: Mailer,
    *,
    charge_id: str,
    dispute_id: str,
    amount_pence: int,
    reason: str | None,
) -> bool:
    """A card chargeback was opened on the charge: put the booking on support hold and tell staff.

    The hold stops every payout path (`check_may_pay_out`) and the client's cancel
    (`check_may_cancel`) until staff clear it or `settle_chargeback` does. The
    dispute id is in the ops email and the log, not on the row. False when no
    booking was paid by that charge (a charge from another system, or a test).
    """
    booking = await repository.get_booking_by_charge_id(session, charge_id)
    if booking is None:
        log.warning("bookings: chargeback on unknown charge=%s dispute=%s", charge_id, dispute_id)
        return False
    await repository_admin.set_support_hold(session, booking.id, hold=True)
    log.warning(
        "bookings: chargeback opened booking=%s dispute=%s pence=%s reason=%s",
        booking.id,
        dispute_id,
        amount_pence,
        reason,
    )
    send_chargeback_alert(
        mailer,
        booking_id=booking.id,
        dispute_id=dispute_id,
        amount_label=_pence_label(amount_pence),
        reason=reason,
        outcome="opened",
    )
    announce_change(session, booking)
    return True


async def settle_chargeback(
    session: AsyncSession,
    mailer: Mailer,
    *,
    charge_id: str,
    dispute_id: str,
    amount_pence: int,
    outcome: str,
) -> bool:
    """The card chargeback closed: `won` lifts the hold, `lost` records the money as refunded.

    Stripe has already taken a lost chargeback from Eventtz's balance, so the booking's
    `payment_status` becomes `refunded` (from `paid`). The hold stays on a lost one:
    staff decide the booking status and whether the vendor hears about it. A loss
    after the vendor was paid out leaves `payout_released` for staff to recover in
    Stripe. Other outcomes (`warning_closed` and the like) are logged and ignored.
    """
    booking = await repository.get_booking_by_charge_id(session, charge_id)
    if booking is None:
        log.warning("bookings: chargeback closed on unknown charge=%s dispute=%s", charge_id, dispute_id)
        return False
    if outcome not in ("won", "lost"):
        log.info(
            "bookings: chargeback closed booking=%s dispute=%s outcome=%s", booking.id, dispute_id, outcome
        )
        return False
    if outcome == "won":
        await repository_admin.set_support_hold(session, booking.id, hold=False)
    else:
        await repository.update_booking(
            session,
            booking.id,
            {"payment_status": domain_payments.REFUNDED},
            payment_status_in=(domain_payments.PAID, domain_payments.PARTIALLY_REFUNDED),
        )
        await repository.update_booking(
            session, booking.id, {}, unset_column="refunded_at", now_columns=("refunded_at",)
        )
    log.warning("bookings: chargeback %s booking=%s dispute=%s", outcome, booking.id, dispute_id)
    send_chargeback_alert(
        mailer,
        booking_id=booking.id,
        dispute_id=dispute_id,
        amount_label=_pence_label(amount_pence),
        reason=None,
        outcome=outcome,
    )
    announce_change(session, booking)
    return True


async def reconcile_external_refund(
    session: AsyncSession,
    mailer: Mailer,
    *,
    charge_id: str,
    amount_pence: int,
    amount_refunded_pence: int,
) -> bool:
    """`charge.refunded` arrived: make `payment_status` agree with what Stripe has refunded.

    Stripe sends this for the app's own refunds too, which already wrote the same
    status, so a matching status is a no-op. Anything else was refunded in the Stripe
    dashboard: the status is corrected so the booking cannot be paid out, and staff
    are emailed to settle the rest. A `payout_released` booking is not rewritten
    (the vendor already has the money); staff are emailed instead. True when the
    booking's status was changed.
    """
    found = await repository.get_booking_by_charge_id(session, charge_id)
    if found is None:
        log.warning("bookings: refund on unknown charge=%s", charge_id)
        return False
    # Wait for an in-flight refund of our own to commit, so its stamps are visible below.
    booking = await lock_and_load_booking(session, found.id)
    target = (
        domain_payments.REFUNDED
        if amount_refunded_pence >= amount_pence
        else domain_payments.PARTIALLY_REFUNDED
    )
    if booking.payment_status == target:
        return False
    deposit_pence = domain_policy.deposit_pence(booking)
    deposit_settled = bool(booking.deposit_refunded_at or booking.deposit_claim_resolved_at)
    if (
        deposit_pence > 0
        and deposit_settled
        and amount_refunded_pence <= deposit_pence
        and booking.payment_status in (domain_payments.PAID, domain_payments.PAYOUT_RELEASED)
    ):
        # The deposit (or what a claim left of it) going back: the booking's own money is untouched.
        log.info("bookings: deposit refund seen booking=%s pence=%s", booking.id, amount_refunded_pence)
        return False
    alert_kwargs = {
        "booking_id": booking.id,
        "refunded_label": _pence_label(amount_refunded_pence),
        "charged_label": _pence_label(amount_pence),
    }
    if booking.payment_status == domain_payments.PAYOUT_RELEASED:
        log.warning("bookings: refund outside the app after payout booking=%s", booking.id)
        send_external_refund_alert(mailer, payment_status=booking.payment_status, **alert_kwargs)
        return False
    changed = await repository.update_booking(
        session,
        booking.id,
        {"payment_status": target},
        payment_status_in=(domain_payments.PAID, domain_payments.PARTIALLY_REFUNDED),
    )
    if not changed:
        return False
    await repository.update_booking(
        session, booking.id, {}, unset_column="refunded_at", now_columns=("refunded_at",)
    )
    log.warning("bookings: refund outside the app recorded booking=%s status=%s", booking.id, target)
    send_external_refund_alert(mailer, payment_status=target, **alert_kwargs)
    announce_change(session, booking)
    return True


async def refund_booking_for_staff(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    booking_id: str,
    amount_pence: int | None,
) -> BookingRow:
    """A staff refund (a dispute resolution): in full when `amount_pence` is None, else that part.

    A partial refund settles the booking's money the way a tiered client cancel does: the
    refund comes off the vendor's price first (Eventtz keeps its fee), what is left of the
    vendor's price is recorded as `cancellation_vendor_share_gbp` with no tier percent, and
    is sent to the vendor at once, or held until their Stripe setup is done. Without that
    record the remainder would sit in Eventtz's balance with no path to the vendor, since
    every payout path needs `paid`.

    A held damage deposit and an upfront payout already sent to a photographer are outside a
    partial refund (`domain_policy.staff_refundable_pence`). A full refund returns everything
    except an upfront payout already sent, deposit included.
    """
    booking = await lock_and_load_booking(session, booking_id)
    booking = await _reconcile_upfront_transfer(session, gateway, booking)
    upfront_paid_pence = domain_policy.held_upfront_pence(booking)
    if amount_pence is None:
        paid_pence = domain_payments.gbp_to_pence(booking.payment_amount_gbp or 0.0)
        # A deposit already refunded or awarded to the vendor is not the client's to get back again.
        settled_deposit_pence = (
            0 if domain_policy.deposit_still_held(booking) else domain_policy.deposit_pence(booking)
        )
        kept_back_pence = upfront_paid_pence + settled_deposit_pence
        if kept_back_pence == 0:
            suffix = "full"
        elif settled_deposit_pence == 0:
            suffix = f"full-after-upfront-{upfront_paid_pence}"
        else:
            suffix = f"full-less-{kept_back_pence}"
        return await _refund_paid_booking(
            session,
            mailer,
            gateway,
            booking,
            amount_pence=None if kept_back_pence == 0 else paid_pence - kept_back_pence,
            idempotency_suffix=suffix,
            refund_body=STAFF_REFUND_BODY,
            includes_deposit=True,
            full_refund=True,
        )
    if amount_pence > domain_policy.staff_refundable_pence(booking):
        raise PartialRefundTooLarge()
    await _refund_paid_booking(
        session,
        mailer,
        gateway,
        booking,
        amount_pence=amount_pence,
        idempotency_suffix="partial",
        refund_body=STAFF_REFUND_BODY,
    )
    vendor_pence = domain_payments.gbp_to_pence(booking.vendor_amount_gbp or 0.0)
    vendor_share_pence = max(0, vendor_pence - amount_pence - upfront_paid_pence)
    await repository.update_booking(
        session,
        booking.id,
        {
            "cancellation_refund_percent": None,
            "cancellation_refund_gbp": domain_payments.pence_to_gbp(amount_pence),
            "cancellation_vendor_share_gbp": domain_payments.pence_to_gbp(vendor_share_pence),
        },
    )
    stored = await _load_booking(session, booking.id)
    if vendor_share_pence > 0:
        await pay_cancellation_share(session, mailer, gateway, stored)
        stored = await _load_booking(session, booking.id)
    return stored


async def prepare_cancel(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    booking: BookingRow,
    *,
    cancelled_by: str,
    by_staff: bool = False,
) -> CancelSettlement:
    """Settle the money before a booking is cancelled; says whether (and how much) was refunded.

    A checkout still open is closed (best effort) so the cancelled booking cannot be
    paid. A paid booking is refunded first; if that fails the error stops the cancel.
    The vendor cancelling, or staff cancelling for either party (`by_staff`, with
    `cancelled_by` naming the party they act for), refunds in full: a deliberate split
    by staff is the dispute `partial_refund` tool. The client cancelling themselves is
    refunded by the vendor's cancellation policy (`domain_cancellation`), and the vendor
    is paid the rest at once.
    """
    if booking.payment_status == "pending":
        await expire_checkout_session(gateway, booking.stripe_checkout_session_id)
        return CancelSettlement(refunded=False)
    if booking.payment_status != domain_payments.PAID:
        return CancelSettlement(refunded=False)
    settlement = domain_cancellation.settlement(booking, datetime.now(UTC))
    if by_staff or cancelled_by != "client" or settlement.full_refund:
        await _refund_paid_booking(
            session,
            mailer,
            gateway,
            booking,
            amount_pence=None,
            idempotency_suffix=f"cancel-{cancelled_by}",
            refund_body=CANCEL_REFUND_BODY,
            includes_deposit=True,
        )
        return CancelSettlement(refunded=True, refund_percent=100)
    return await _settle_tiered_cancel(session, mailer, gateway, booking, settlement)


async def _settle_tiered_cancel(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    booking: BookingRow,
    settlement: domain_cancellation.CancellationSettlement,
) -> CancelSettlement:
    """Refund the client their tier's share, record the split, then pay the vendor the rest.

    The refund key carries the pence, so a retry after the tier rolled over cannot reuse
    a key with a different amount. The booking ends `partially_refunded` even when the
    tier left nothing to refund (a zero service fee at 0%), so "cancelled +
    partially_refunded" always means "the money was split at cancel".
    """
    paid_gbp = float(booking.payment_amount_gbp or 0.0)
    if settlement.refund_pence > 0:
        await _refund_paid_booking(
            session,
            mailer,
            gateway,
            booking,
            amount_pence=settlement.refund_pence,
            idempotency_suffix=f"cancel-client-{settlement.refund_pence}",
            refund_body=tiered_refund_body(settlement, paid_gbp),
            # Everything above the vendor's price comes back on a tiered cancel, deposit included.
            includes_deposit=True,
        )
    else:
        await repository.update_booking(
            session,
            booking.id,
            {"payment_status": domain_payments.PARTIALLY_REFUNDED},
            payment_status_in=(domain_payments.PAID,),
        )
        # Nothing to refund, but the client still hears what their tier decided.
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.client_user_id,
            booking_id=booking.id,
            kind="payment_refunded",
            body=tiered_refund_body(settlement, paid_gbp),
        )
    refund_gbp = domain_payments.pence_to_gbp(settlement.refund_pence)
    vendor_share_gbp = domain_payments.pence_to_gbp(settlement.vendor_share_pence)
    await repository.update_booking(
        session,
        booking.id,
        {
            "cancellation_refund_percent": settlement.refund_percent,
            "cancellation_refund_gbp": refund_gbp,
            "cancellation_vendor_share_gbp": vendor_share_gbp,
        },
    )
    stored = await _load_booking(session, booking.id)
    vendor_share_paid = await pay_cancellation_share(session, mailer, gateway, stored)
    return CancelSettlement(
        refunded=True,
        refund_percent=settlement.refund_percent,
        refund_gbp=refund_gbp,
        vendor_share_gbp=vendor_share_gbp,
        vendor_share_paid=vendor_share_paid,
    )


async def pay_cancellation_share(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow
) -> bool:
    """Transfer the vendor the share a partial refund left them; True once it has been sent.

    The share comes from a tiered client cancel or a staff partial refund. Called when the
    split is made and again by the staff `release-payout` tool when the vendor's Stripe
    account was not ready the first time. A Stripe refusal is logged and alerted (the
    split itself stands: the client's refund has already gone through) and the share
    stays recorded with `cancellation_payout_at` empty, so it can be retried.
    """
    if booking.cancellation_payout_at is not None:
        return True
    amount_pence = domain_payments.gbp_to_pence(booking.cancellation_vendor_share_gbp or 0.0)
    if amount_pence <= 0:
        return False
    # No tier percent means staff split the money, not the vendor's policy.
    staff_split = booking.cancellation_refund_percent is None
    vendor = await vendor_payouts.vendor_for_payouts(session, booking.vendor_user_id)
    destination_account_id = vendor.stripe_account_id if vendor is not None else None
    if not destination_account_id or not (vendor is not None and vendor.stripe_payouts_enabled):
        log.warning("bookings: cancellation share held booking=%s: vendor payouts not enabled", booking.id)
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.vendor_user_id,
            booking_id=booking.id,
            kind="payout_held_connect_incomplete",
            body=_STAFF_SPLIT_SHARE_HELD_BODY if staff_split else _CANCELLATION_SHARE_HELD_BODY,
        )
        return False
    try:
        transfer_id = await transfer_to_vendor(
            session,
            mailer,
            gateway,
            booking,
            destination_account_id=destination_account_id,
            amount_pence=amount_pence,
        )
    except PayoutReleaseFailed:
        return False
    await repository.update_booking(
        session,
        booking.id,
        {"stripe_transfer_id": transfer_id},
        unset_column="cancellation_payout_at",
        now_columns=("cancellation_payout_at",),
    )
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking.id,
        kind="vendor_payout_released",
        body=_STAFF_SPLIT_SHARE_PAID_BODY if staff_split else _CANCELLATION_SHARE_PAID_BODY,
        send_email=False,
    )
    return True


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


def _transfer_group_for(booking_id: str, part: str | None) -> str:
    """The Stripe transfer group of one payout of a booking.

    The main payout uses `booking_<id>`; a split's first part (`upfront`) and a deposit award
    (`deposit`) each have their own group, so finding an earlier Transfer for one part never
    mistakes another part's Transfer for it.
    """
    base_group = domain_payments.transfer_group(booking_id)
    return f"{base_group}_{part}" if part else base_group


async def _existing_transfer_id(
    gateway: PaymentGateway, booking_id: str, part: str | None = None
) -> str | None:
    """A Transfer already made for this payout of the booking, found by its group; None if none."""
    try:
        transfer_ids = await gateway.list_transfer_ids(_transfer_group_for(booking_id, part))
    except (PaymentGatewayError, PaymentsUnavailable):
        log.exception("bookings: list transfers failed booking=%s", booking_id)
        return None
    return transfer_ids[0] if transfer_ids else None


async def transfer_to_vendor(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    booking: BookingRow,
    *,
    destination_account_id: str,
    amount_pence: int,
    part: str | None = None,
) -> str:
    """The id of the Transfer paying the vendor: an earlier one for this payout, else a new one.

    `part` names a payout other than the main one (`upfront`, `deposit`); its idempotency key
    and transfer group carry the name, so each part moves money at most once.
    """
    existing_transfer_id = await _existing_transfer_id(gateway, booking.id, part)
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
            transfer_group=_transfer_group_for(booking.id, part),
            metadata={"booking_id": booking.id, **({"payout_part": part} if part else {})},
            source_charge_id=source_charge_id,
            idempotency_key=domain_payments.transfer_idempotency_key(
                booking_id=f"{booking.id}-{part}" if part else booking.id,
                amount_pence=amount_pence,
                destination_account_id=destination_account_id,
                source_charge_id=source_charge_id,
            ),
        )
    except (PaymentGatewayError, PaymentsUnavailable) as transfer_error:
        # A clash with an earlier attempt's key means that attempt may have paid already.
        reclaimed_transfer_id = await _existing_transfer_id(gateway, booking.id, part)
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
    session: AsyncSession,
    mailer: Mailer,
    booking: BookingRow,
    *,
    amount_pence: int,
    stage: domain_policy.PayoutStage,
) -> None:
    """Record the completed booking and tell both parties what the vendor has been paid.

    The event is completed by the first payout (`full` or `upfront`); a split's `final`
    payout only tells the vendor the rest has gone. After a split's first part the client
    is asked to confirm delivery instead of being told the booking is complete.
    """
    if stage != "final":
        # The refundable deposit is not part of what the booking was worth.
        paid_pence = domain_payments.gbp_to_pence(booking.payment_amount_gbp or 0.0)
        deposit_paid_pence = domain_policy.deposit_pence(booking)
        booking_value_pence = paid_pence - deposit_paid_pence if paid_pence else amount_pence
        booking_value_gbp = domain_payments.pence_to_gbp(booking_value_pence)
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
            kind="awaiting_delivery" if stage == "upfront" else "booking_completed",
            mode="insert_if_absent",
        )
    vendor_kind = {
        "upfront": "vendor_upfront_released",
        "final": "vendor_final_released",
    }.get(stage, "vendor_payout_released")
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.vendor_user_id,
        booking_id=booking.id,
        kind=vendor_kind,
        body=_PAYOUT_RELEASED_BODY if vendor_kind == "vendor_payout_released" else None,
        send_email=False,
    )
    announce_change(session, booking)


def _release_stage(booking: BookingRow, *, by_staff: bool) -> domain_policy.PayoutStage:
    """Which payout to make now. Staff releasing (a dispute or recovery) always pays everything left."""
    stage = domain_policy.payout_stage(booking, datetime.now(UTC))
    if by_staff and stage == "upfront":
        return "full"
    if by_staff and stage == "waiting_delivery":
        return "final"
    return stage


def _stage_amount_pence(booking: BookingRow, stage: domain_policy.PayoutStage) -> int:
    """What this payout transfers: the whole share, a split's first part, or what the first part left."""
    vendor_pence = domain_payments.gbp_to_pence(booking.vendor_amount_gbp or 0.0)
    if stage == "upfront":
        return domain_policy.upfront_pence(vendor_pence, booking.payout_upfront_percent or 0)
    if stage == "final":
        return vendor_pence - domain_policy.held_upfront_pence(booking)
    return vendor_pence


async def _record_stage_payout(
    session: AsyncSession,
    booking: BookingRow,
    *,
    stage: domain_policy.PayoutStage,
    transfer_id: str,
    amount_pence: int,
) -> bool:
    """Write the payout this stage made, conditional on the state it was made from; True when written."""
    if stage == "upfront":
        # The event is over and the first part paid: completed, money still held for the rest.
        return await repository.update_booking(
            session,
            booking.id,
            {
                "status": "completed",
                "upfront_amount_gbp": domain_payments.pence_to_gbp(amount_pence),
                "upfront_transfer_id": transfer_id,
            },
            status_in=("accepted",),
            payment_status_in=(domain_payments.PAID,),
            unset_column="upfront_payout_at",
            now_columns=("upfront_payout_at", "completed_at"),
        )
    if stage == "final":
        return await repository.update_booking(
            session,
            booking.id,
            {"payment_status": domain_payments.PAYOUT_RELEASED, "stripe_transfer_id": transfer_id},
            status_in=("completed",),
            payment_status_in=(domain_payments.PAID,),
            now_columns=("payout_released_at",),
        )
    return await repository.update_booking(
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


async def release_vendor_payout(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    booking_id: str,
    by_staff: bool = False,
) -> ConfirmCompletionResponse:
    """Pay the vendor by Transfer, then record it: in full, or one part of a split payout.

    Most bookings are paid in one Transfer and end completed + `payout_released`. A split
    booking (photography, `domain_policy.payout_stage`) is paid its first part here and
    ends completed but still `paid`; the rest is paid by a later call once the client
    confirms delivery or the delivery deadline passes, and nothing is sent in between.
    A vendor Stripe cannot pay yet is told the payout is held and the booking stays
    paid. The final write is conditional on the state the payout started from, so a
    second caller that lost the race returns the stored state instead of notifying twice.
    """
    booking = await lock_and_load_booking(session, booking_id)
    if booking.payment_status != domain_payments.PAID:
        # Refunded, released or disputed away while the caller decided: nothing left to pay.
        return _completion_state(booking)
    stage = _release_stage(booking, by_staff=by_staff)
    if stage != "upfront":
        # Paying the first part already reuses any earlier upfront Transfer; any other stage
        # must first see one whose database write was lost, or it would pay that part twice.
        booking = await _reconcile_upfront_transfer(session, gateway, booking)
        stage = _release_stage(booking, by_staff=by_staff)
    if stage == "waiting_delivery":
        return _completion_state(booking)
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

    amount_pence = _stage_amount_pence(booking, stage)
    if amount_pence <= 0:
        hint = (
            f"vendor_amount_gbp is missing or zero (raw={booking.vendor_amount_gbp!r}, stage={stage}); "
            "cannot create a Stripe Transfer."
        )
        log.error("bookings: cannot release payout booking=%s: %s", booking.id, hint)
        await send_payout_stuck_alert(
            session, mailer, booking_id=booking.id, vendor_user_id=booking.vendor_user_id, error_hint=hint
        )
        raise PayoutAmountMissing()

    transfer_id = await transfer_to_vendor(
        session,
        mailer,
        gateway,
        booking,
        destination_account_id=destination_account_id,
        amount_pence=amount_pence,
        part="upfront" if stage == "upfront" else None,
    )
    released = await _record_stage_payout(
        session, booking, stage=stage, transfer_id=transfer_id, amount_pence=amount_pence
    )
    stored = await _load_booking(session, booking.id)
    if not released:
        if stored.payment_status != domain_payments.PAYOUT_RELEASED and not stored.upfront_payout_at:
            log.error(
                "bookings: transfer=%s made but booking=%s not updated status=%s payment=%s",
                transfer_id,
                booking.id,
                stored.status,
                stored.payment_status,
            )
        return _completion_state(stored)
    await _announce_payout(session, mailer, stored, amount_pence=amount_pence, stage=stage)
    if stage != "upfront":
        try:
            await service_receipts.freeze_after_payout(session, mailer, booking.id)
        except Exception:
            log.warning("bookings: receipt freeze after payout failed booking=%s", booking.id, exc_info=True)
    return _completion_state(stored)


async def release_payout_for_staff(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, *, booking_id: str
) -> ConfirmCompletionResponse:
    """A staff payout (a dispute resolution or recovery): pay the vendor without both confirmations."""
    booking = await _load_booking(session, booking_id)
    if booking.payment_status != domain_payments.PAID:
        raise OnlyPaidPayoutRelease()
    return await release_vendor_payout(session, mailer, gateway, booking_id=booking.id, by_staff=True)
