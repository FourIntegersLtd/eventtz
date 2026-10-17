"""Refundable damage deposits (rentals, decor): returned by themselves, or split by staff after a claim.

The client pays the deposit at checkout on top of the booking total; Eventtz holds it
like the rest of the payment (held funds, AGENTS.md). Seven days after the event's last
day (`domain_policy.DEPOSIT_CLAIM_DAYS`) an unclaimed deposit is refunded by the hourly
job. Until then the vendor may claim some or all of it, with a reason; staff then decide
how much the vendor keeps (paid by a Transfer) and the rest goes back to the client.

The deposit never changes `payment_status`: it is a side pot of the same payment, tracked
by its own `deposit_*` columns. Every Refund and Transfer carries an idempotency key.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway, PaymentGatewayError, PaymentsUnavailable
from app.features.bookings import (
    domain_maintenance,
    domain_payments,
    domain_policy,
    repository,
    repository_admin,
    repository_maintenance,
)
from app.features.bookings.errors import (
    BookingNotFound,
    DepositAwardInvalid,
    DepositClaimClosed,
    DepositClaimInvalid,
    DepositVendorPayoutsNotReady,
    NoDepositClaim,
    NoPaymentOnRecord,
    PayoutBlockedByDispute,
    PayoutOnSupportHold,
    RefundFailed,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.service_common import announce_change
from app.features.bookings.service_maintenance import each_booking_in_pages
from app.features.bookings.service_payments import lock_and_load_booking, transfer_to_vendor
from app.features.notifications import service_booking as notices
from app.features.notifications.service_payment_alerts import (
    send_deposit_claim_alert,
    send_refund_failed_alert,
)
from app.features.vendors import service_payouts as vendor_payouts

log = get_logger(__name__)

# The longest reason a vendor may give for a claim (it is emailed to staff).
CLAIM_NOTE_MAX_LENGTH = 2000
# The shortest reason: a claim must say what was damaged or missing.
CLAIM_NOTE_MIN_LENGTH = 10
# How much of a Stripe error is put in the staff alert.
_ERROR_HINT_LIMIT = 500


def _gbp_label(amount_pence: int) -> str:
    """`£12.50` for an amount in pence (staff alert and notice wording)."""
    return f"£{amount_pence // 100}.{amount_pence % 100:02d}"


async def _refund_deposit_part(
    mailer: Mailer, gateway: PaymentGateway, booking: BookingRow, *, amount_pence: int, suffix: str
) -> None:
    """Refund `amount_pence` of the deposit to the client's card; raises `RefundFailed` (staff alerted)."""
    if not booking.stripe_payment_intent_id:
        raise NoPaymentOnRecord()
    try:
        await gateway.create_refund(
            payment_intent_id=booking.stripe_payment_intent_id,
            amount_pence=amount_pence,
            metadata={"booking_id": booking.id, "refund_part": suffix},
            idempotency_key=domain_payments.refund_idempotency_key(booking.id, suffix),
        )
    except (PaymentGatewayError, PaymentsUnavailable) as refund_error:
        log.exception("bookings: deposit refund failed booking=%s", booking.id)
        send_refund_failed_alert(
            mailer, booking_id=booking.id, error_hint=str(refund_error)[:_ERROR_HINT_LIMIT]
        )
        raise RefundFailed() from refund_error


async def refund_deposit(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow
) -> bool:
    """Send an unclaimed deposit back in full and record it; True when this call returned it.

    The row is locked and re-read first, so a staff refund or claim that landed meanwhile wins.
    The refund is made first (its idempotency key makes a retry safe), then the stamp is
    written only if it is still empty, so two overlapping runs notify the client once.
    """
    booking = await lock_and_load_booking(session, booking.id)
    if booking.support_hold or not domain_policy.deposit_refund_due(booking, datetime.now(UTC)):
        return False
    await _refund_deposit_part(
        mailer, gateway, booking, amount_pence=domain_policy.deposit_pence(booking), suffix="deposit"
    )
    stamped = await repository.update_booking(
        session, booking.id, {}, unset_column="deposit_refunded_at", now_columns=("deposit_refunded_at",)
    )
    if not stamped:
        return False
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="deposit_refunded",
        mode="insert_if_absent",
    )
    announce_change(session, booking)
    return True


async def refund_due_deposits(session: AsyncSession, mailer: Mailer, gateway: PaymentGateway) -> int:
    """The hourly step: refund every deposit whose claim window has ended unclaimed; returns how many.

    A support hold keeps the deposit too (staff are looking at the booking). Each refund
    runs in a savepoint so one Stripe failure (logged, staff alerted) never stops the rest.
    """
    now = datetime.now(UTC)
    candidates = each_booking_in_pages(
        lambda after_id: repository_maintenance.bookings_holding_deposit(
            session, limit=domain_maintenance.MAINTENANCE_BATCH_LIMIT, after_id=after_id
        )
    )
    refunded = 0
    async for booking in candidates:
        if booking.support_hold or not domain_policy.deposit_refund_due(booking, now):
            continue
        try:
            async with repository_maintenance.reminder_savepoint(session):
                if await refund_deposit(session, mailer, gateway, booking):
                    refunded += 1
        except (RefundFailed, NoPaymentOnRecord):
            log.warning("bookings: deposit refund left for next run booking=%s", booking.id)
    owing = await repository_maintenance.bookings_owing_deposit_remainder(
        session, limit=domain_maintenance.MAINTENANCE_BATCH_LIMIT
    )
    for booking in owing:
        try:
            async with repository_maintenance.reminder_savepoint(session):
                if await _refund_claim_remainder(session, mailer, gateway, booking.id):
                    refunded += 1
        except (RefundFailed, NoPaymentOnRecord):
            log.warning("bookings: deposit remainder refund left for next run booking=%s", booking.id)
    return refunded


async def _refund_claim_remainder(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking_id: str
) -> bool:
    """Refund what a decided claim left of the deposit, and stamp it; True when this call stamped it.

    The amount is fixed by the stored award and the key by the booking, so retrying after a
    failed refund sends the same refund and Stripe returns the first one if it did go through.
    """
    booking = await lock_and_load_booking(session, booking_id)
    award_pence = domain_payments.gbp_to_pence(booking.deposit_claim_awarded_gbp or 0.0)
    remainder_pence = domain_policy.deposit_pence(booking) - award_pence
    if (
        not booking.deposit_claim_resolved_at
        or booking.deposit_refunded_at
        or remainder_pence <= 0
        or booking.payment_status not in domain_policy.DEPOSIT_HOLDING_PAYMENT_STATUSES
    ):
        return False
    await _refund_deposit_part(
        mailer, gateway, booking, amount_pence=remainder_pence, suffix="deposit-remainder"
    )
    return await repository.update_booking(
        session, booking.id, {}, unset_column="deposit_refunded_at", now_columns=("deposit_refunded_at",)
    )


async def claim_deposit(
    session: AsyncSession,
    mailer: Mailer,
    *,
    vendor_user_id: str,
    booking_id: str,
    amount_gbp: float,
    note: str,
) -> BookingRow:
    """The vendor asks to keep `amount_gbp` of the deposit, saying why; staff decide.

    Allowed from the event's first day until the claim window ends, once per booking.
    The client is told and staff are emailed; nothing moves until staff resolve it.
    """
    booking = await repository.get_booking(session, booking_id, vendor_user_id=vendor_user_id)
    if booking is None:
        raise BookingNotFound()
    if not domain_policy.deposit_claim_open(booking, datetime.now(UTC)):
        raise DepositClaimClosed()
    claim_pence = domain_payments.gbp_to_pence(amount_gbp)
    reason = note.strip()
    if not 0 < claim_pence <= domain_policy.deposit_pence(booking):
        raise DepositClaimInvalid()
    if not CLAIM_NOTE_MIN_LENGTH <= len(reason) <= CLAIM_NOTE_MAX_LENGTH:
        raise DepositClaimInvalid()
    claimed = await repository.update_booking(
        session,
        booking.id,
        {"deposit_claim_gbp": domain_payments.pence_to_gbp(claim_pence), "deposit_claim_note": reason},
        vendor_user_id=vendor_user_id,
        unset_column="deposit_claimed_at",
        now_columns=("deposit_claimed_at",),
    )
    if not claimed:
        raise DepositClaimClosed()
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="deposit_claim_opened",
        mode="insert_if_absent",
    )
    send_deposit_claim_alert(
        mailer,
        booking_id=booking.id,
        claim_label=_gbp_label(claim_pence),
        deposit_label=_gbp_label(domain_policy.deposit_pence(booking)),
        note=reason,
    )
    announce_change(session, booking)
    stored = await repository.get_booking(session, booking.id)
    if stored is None:
        raise BookingNotFound()
    return stored


async def resolve_deposit_claim(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    booking_id: str,
    award_gbp: float,
) -> BookingRow:
    """Staff decide a deposit claim: the vendor keeps `award_gbp`, the client gets the rest.

    The vendor's part is a Transfer (`part="deposit"`), made first; a vendor Stripe cannot
    pay yet, a support hold or an open problem report is refused before anything moves.
    The decision is recorded straight after the Transfer, before the client's Refund: a
    failed Refund then leaves the decision standing (so a retry cannot change the award
    after the vendor was paid) and the hourly job retries the Refund with the same key.
    """
    booking = await lock_and_load_booking(session, booking_id)
    if not booking.deposit_claimed_at or not domain_policy.deposit_still_held(booking):
        raise NoDepositClaim()
    if booking.support_hold:
        raise PayoutOnSupportHold()
    if await repository_admin.has_active_dispute(session, booking.id):
        raise PayoutBlockedByDispute()
    deposit_total_pence = domain_policy.deposit_pence(booking)
    claim_pence = domain_payments.gbp_to_pence(booking.deposit_claim_gbp or 0.0)
    award_pence = domain_payments.gbp_to_pence(award_gbp)
    if not 0 <= award_pence <= min(claim_pence, deposit_total_pence):
        raise DepositAwardInvalid()

    transfer_id: str | None = None
    if award_pence > 0:
        vendor = await vendor_payouts.vendor_for_payouts(session, booking.vendor_user_id)
        if vendor is None or not vendor.stripe_account_id or not vendor.stripe_payouts_enabled:
            raise DepositVendorPayoutsNotReady()
        transfer_id = await transfer_to_vendor(
            session,
            mailer,
            gateway,
            booking,
            destination_account_id=vendor.stripe_account_id,
            amount_pence=award_pence,
            part="deposit",
        )
    remainder_pence = deposit_total_pence - award_pence
    resolved = await repository.update_booking(
        session,
        booking.id,
        {
            "deposit_claim_awarded_gbp": domain_payments.pence_to_gbp(award_pence),
            "deposit_transfer_id": transfer_id,
        },
        unset_column="deposit_claim_resolved_at",
        now_columns=("deposit_claim_resolved_at",),
    )
    if resolved and remainder_pence > 0:
        try:
            await _refund_claim_remainder(session, mailer, gateway, booking.id)
        except (RefundFailed, NoPaymentOnRecord):
            # Staff were alerted; the decision stands and the hourly job retries the refund.
            log.warning("bookings: deposit remainder refund failed, retried hourly booking=%s", booking.id)
    if resolved:
        body = (
            f"Eventtz support has decided the deposit claim. The vendor keeps {_gbp_label(award_pence)} "
            f"and {_gbp_label(remainder_pence)} goes back to the client's card."
        )
        # One notice kind per side: a booking holds at most one notice of each kind.
        for user_id, kind in (
            (booking.client_user_id, "deposit_claim_resolved"),
            (booking.vendor_user_id, "vendor_deposit_claim_resolved"),
        ):
            await notices.dispatch_booking_notification(
                session,
                mailer,
                user_id=user_id,
                booking_id=booking.id,
                kind=kind,
                body=body,
                mode="insert_if_absent",
            )
        announce_change(session, booking)
    stored = await repository.get_booking(session, booking.id)
    if stored is None:
        raise BookingNotFound()
    return stored
