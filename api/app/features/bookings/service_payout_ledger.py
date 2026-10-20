"""The vendor payout ledger: what Eventtz has sent a vendor, and what is still coming.

Vendors see their own earnings here, never `total_label` (the client total, which
includes the Eventtz fee the vendor never receives). A booking appears once its
payment was collected: `paid` (Transfer still to come) or `payout_released`
(Transfer sent), or once a partial refund (a tiered client cancel, `domain_cancellation`,
or a staff dispute refund) left the vendor a share of the payment. A `pending` checkout
is money Eventtz has not received yet.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository_payments
from app.features.bookings.domain_payments import PAYOUT_RELEASED
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas_payments import VendorPayoutLedger, VendorPayoutRow
from app.features.identity import service as identity
from app.features.pricing import service as pricing


def vendor_amount_for(booking: BookingRow) -> float:
    """The vendor's share: the snapshot taken at payment, or today's price for older rows without one."""
    if booking.vendor_amount_gbp is not None:
        return round(float(booking.vendor_amount_gbp), 2)
    return float(pricing.vendor_portion_gbp(booking.line_items, booking.vendor_adjustments))


def _is_cancellation_share(booking: BookingRow) -> bool:
    """True when a partial refund left the vendor a recorded share, whatever the booking's status."""
    return (booking.cancellation_vendor_share_gbp or 0.0) > 0


def _newest_first_key(booking: BookingRow) -> str:
    """Sort key: when the payout went out, else when the client paid, else when the booking was made."""
    return str(
        booking.payout_released_at
        or booking.cancellation_payout_at
        or booking.paid_at
        or booking.created_at
        or ""
    )


async def vendor_payout_ledger(session: AsyncSession, vendor_user_id: str) -> VendorPayoutLedger:
    """Payout rows, newest first, with paid-out and awaiting totals."""
    bookings = sorted(
        await repository_payments.payout_ledger_bookings(session, vendor_user_id),
        key=_newest_first_key,
        reverse=True,
    )
    client_names = await identity.client_display_names(
        session, sorted({booking.client_user_id for booking in bookings})
    )
    payouts: list[VendorPayoutRow] = []
    paid_out_total = 0.0
    paid_out_last_30_days = 0.0
    awaiting_total = 0.0
    cutoff = datetime.now(tz=UTC) - timedelta(days=30)
    for booking in bookings:
        share = _is_cancellation_share(booking)
        released = (
            booking.cancellation_payout_at is not None if share else booking.payment_status == PAYOUT_RELEASED
        )
        amount = (
            round(float(booking.cancellation_vendor_share_gbp or 0.0), 2)
            if share
            else vendor_amount_for(booking)
        )
        paid_out_at = None
        if released:
            paid_out_at = booking.cancellation_payout_at if share else booking.payout_released_at
        if released:
            paid_out_total += amount
            if paid_out_at:
                try:
                    paid_time = datetime.fromisoformat(str(paid_out_at).replace("Z", "+00:00"))
                    if paid_time.tzinfo is None:
                        paid_time = paid_time.replace(tzinfo=UTC)
                    if paid_time >= cutoff:
                        paid_out_last_30_days += amount
                except ValueError:
                    pass
        else:
            awaiting_total += amount
        payouts.append(
            VendorPayoutRow(
                booking_id=booking.id,
                event_name=booking.event_name,
                event_date=booking.event_date[:10] or None,
                client_display_name=client_names.get(booking.client_user_id),
                amount_gbp=amount,
                amount_label=pricing.format_gbp(amount),
                status="paid_out" if released else "awaiting_payout",
                paid_out_at=paid_out_at,
                kind="cancellation_share" if share else "event_payout",
            )
        )
    paid_out_total = round(paid_out_total, 2)
    paid_out_last_30_days = round(paid_out_last_30_days, 2)
    awaiting_total = round(awaiting_total, 2)
    return VendorPayoutLedger(
        payouts=payouts,
        total_paid_out_gbp=paid_out_total,
        total_paid_out_label=pricing.format_gbp(paid_out_total),
        paid_out_last_30_days_gbp=paid_out_last_30_days,
        paid_out_last_30_days_label=pricing.format_gbp(paid_out_last_30_days),
        total_awaiting_gbp=awaiting_total,
        total_awaiting_label=pricing.format_gbp(awaiting_total),
    )


async def vendor_has_payout_history(session: AsyncSession, vendor_user_id: str) -> bool:
    """True once any of the vendor's bookings was paid out by Stripe Transfer.

    Such a vendor's Connect account is never cleared automatically: the money trail
    runs through it, so staff look before it is replaced.
    """
    return await repository_payments.vendor_has_transfer(session, vendor_user_id)


async def latest_payout_transfer_id(session: AsyncSession, vendor_user_id: str) -> str | None:
    """The Stripe Transfer id of the vendor's most recently paid booking, or None if never paid out.

    Its destination is the vendor's Connect account, which is how staff recover a lost one.
    """
    return await repository_payments.latest_transfer_id_for_vendor(session, vendor_user_id)
