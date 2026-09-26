"""The vendor payout ledger: what Eventtz has sent a vendor, and what is still coming.

Vendors see their own earnings here, never `total_label` (the client total, which
includes the Eventtz fee the vendor never receives). A booking appears once its
payment was collected: `paid` (Transfer still to come) or `payout_released`
(Transfer sent). A `pending` checkout is money Eventtz has not received yet.
"""

from __future__ import annotations

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


def _newest_first_key(booking: BookingRow) -> str:
    """Sort key: when the payout went out, else when the client paid, else when the booking was made."""
    return str(booking.payout_released_at or booking.paid_at or booking.created_at or "")


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
    awaiting_total = 0.0
    for booking in bookings:
        released = booking.payment_status == PAYOUT_RELEASED
        amount = vendor_amount_for(booking)
        if released:
            paid_out_total += amount
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
                paid_out_at=booking.payout_released_at if released else None,
            )
        )
    paid_out_total = round(paid_out_total, 2)
    awaiting_total = round(awaiting_total, 2)
    return VendorPayoutLedger(
        payouts=payouts,
        total_paid_out_gbp=paid_out_total,
        total_paid_out_label=pricing.format_gbp(paid_out_total),
        total_awaiting_gbp=awaiting_total,
        total_awaiting_label=pricing.format_gbp(awaiting_total),
    )


async def vendor_has_payout_history(session: AsyncSession, vendor_user_id: str) -> bool:
    """True once any of the vendor's bookings was paid out by Stripe Transfer.

    Such a vendor's Connect account is never cleared automatically: the money trail
    runs through it, so staff look before it is replaced.
    """
    return await repository_payments.vendor_has_transfer(session, vendor_user_id)
