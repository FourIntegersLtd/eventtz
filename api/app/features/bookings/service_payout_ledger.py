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

from app.core.pagination import DEFAULT_LIST_LIMIT
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


def _released_amount_and_time(booking: BookingRow) -> tuple[bool, float, str | None]:
    """Whether this ledger row has been paid out, the vendor's amount for it, and when it was paid out."""
    share = _is_cancellation_share(booking)
    released = (
        booking.cancellation_payout_at is not None if share else booking.payment_status == PAYOUT_RELEASED
    )
    amount = (
        round(float(booking.cancellation_vendor_share_gbp or 0.0), 2) if share else vendor_amount_for(booking)
    )
    paid_out_at = None
    if released:
        paid_out_at = booking.cancellation_payout_at if share else booking.payout_released_at
    return released, amount, paid_out_at


def _paid_out_since(paid_out_at: str | None, cutoff: datetime) -> bool:
    """True when the ISO `paid_out_at` is on or after `cutoff`; an unreadable stamp counts as not."""
    if not paid_out_at:
        return False
    try:
        paid_time = datetime.fromisoformat(str(paid_out_at).replace("Z", "+00:00"))
    except ValueError:
        return False
    if paid_time.tzinfo is None:
        paid_time = paid_time.replace(tzinfo=UTC)
    return paid_time >= cutoff


async def vendor_payout_ledger(
    session: AsyncSession, vendor_user_id: str, *, offset: int = 0, limit: int = DEFAULT_LIST_LIMIT
) -> tuple[VendorPayoutLedger, int]:
    """One page of payout rows, newest first, with whole-ledger paid-out and awaiting totals.

    Returns the ledger and how many rows it has in all. The page and the totals are computed in
    the database; only bookings from before payment-time snapshots existed are priced here.
    """
    cutoff = datetime.now(tz=UTC) - timedelta(days=30)
    sums = await repository_payments.payout_ledger_sums(session, vendor_user_id, since=cutoff)
    paid_out_total = float(sums.paid_out)
    paid_out_last_30_days = float(sums.paid_out_since)
    awaiting_total = float(sums.awaiting)
    for booking in sums.unsnapshotted:
        released, amount, paid_out_at = _released_amount_and_time(booking)
        if released:
            paid_out_total += amount
            if _paid_out_since(paid_out_at, cutoff):
                paid_out_last_30_days += amount
        else:
            awaiting_total += amount
    bookings, total = await repository_payments.payout_ledger_page(
        session, vendor_user_id, offset=offset, limit=limit
    )
    client_names = await identity.client_display_names(
        session, sorted({booking.client_user_id for booking in bookings})
    )
    payouts: list[VendorPayoutRow] = []
    for booking in bookings:
        released, amount, paid_out_at = _released_amount_and_time(booking)
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
                kind="cancellation_share" if _is_cancellation_share(booking) else "event_payout",
            )
        )
    paid_out_total = round(paid_out_total, 2)
    paid_out_last_30_days = round(paid_out_last_30_days, 2)
    awaiting_total = round(awaiting_total, 2)
    ledger = VendorPayoutLedger(
        payouts=payouts,
        total_paid_out_gbp=paid_out_total,
        total_paid_out_label=pricing.format_gbp(paid_out_total),
        paid_out_last_30_days_gbp=paid_out_last_30_days,
        paid_out_last_30_days_label=pricing.format_gbp(paid_out_last_30_days),
        total_awaiting_gbp=awaiting_total,
        total_awaiting_label=pricing.format_gbp(awaiting_total),
    )
    return ledger, total


async def vendor_held_payout_count(session: AsyncSession, vendor_user_id: str) -> int:
    """How many ledger rows are still awaiting payout; the same rows `total_awaiting_gbp` sums."""
    sums = await repository_payments.payout_ledger_sums(
        session, vendor_user_id, since=datetime.now(tz=UTC) - timedelta(days=30)
    )
    return sums.awaiting_count + sum(
        1 for booking in sums.unsnapshotted if not _released_amount_and_time(booking)[0]
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
