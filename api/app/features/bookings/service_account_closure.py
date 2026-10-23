"""What account closure (identity's `service_deletion`) needs from bookings.

The gates read every booking the closing account is a party to; the clean-up cancels
the ones that are still only an enquiry (pending and unpaid) and tells the other side.
Baseline: `backend/app/features/settings/account_deletion_gates.py:53-77` and
`account_deletion_erase.py:20-64`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer
from app.features.bookings import domain, repository
from app.features.bookings.rows import BookingRow
from app.features.bookings.service_common import announce_change
from app.features.notifications import service_booking as notices

# What the other party reads on their cancelled enquiry (baseline `account_deletion_erase.py:57`).
CLOSED_ACCOUNT_CANCEL_BODY = (
    "The other person has closed their Eventtz account, so this enquiry is cancelled."
)


@dataclass(frozen=True)
class ClosureBooking:
    """One booking of the closing account, reduced to what the deletion gates read."""

    id: str
    status: str
    payment_status: str
    event_day_over: bool


async def _bookings_of(session: AsyncSession, user_id: str) -> list[BookingRow]:
    """Every booking where the account is the client or the vendor, each once (client side first)."""
    found: dict[str, BookingRow] = {}
    for party in ("client", "vendor"):
        bookings = await repository.list_bookings(
            session,
            client_user_id=user_id if party == "client" else None,
            vendor_user_id=user_id if party == "vendor" else None,
            statuses=None,
            status=None,
            payment_statuses=None,
            exclude_payment_status=None,
        )
        for booking in bookings:
            found.setdefault(booking.id, booking)
    return list(found.values())


async def closure_blockers(session: AsyncSession, user_id: str) -> list[ClosureBooking]:
    """The account's bookings with the facts the deletion gates decide on (event day judged now, London)."""
    now = datetime.now(UTC)
    return [
        ClosureBooking(
            id=booking.id,
            status=booking.status,
            payment_status=booking.payment_status or "unpaid",
            event_day_over=domain.event_day_over(booking, now),
        )
        for booking in await _bookings_of(session, user_id)
    ]


async def cancel_open_requests_on_closure(session: AsyncSession, mailer: Mailer, user_id: str) -> int:
    """Cancel the account's pending, unpaid bookings on its behalf and notify the other party.

    Returns how many were cancelled. Each write is conditional on the booking still being
    pending, so one the other side just accepted is left alone.
    """
    cancelled_count = 0
    for booking in await _bookings_of(session, user_id):
        if booking.status != "pending" or (booking.payment_status or "unpaid") != "unpaid":
            continue
        closing_side_is_client = booking.client_user_id == user_id
        closing_side = "client" if closing_side_is_client else "vendor"
        changed = await repository.update_booking(
            session,
            booking.id,
            {"status": "cancelled", "cancelled_by": closing_side},
            status_in=("pending",),
            now_columns=("cancelled_at",),
        )
        if not changed:
            continue
        cancelled_count += 1
        other_user_id = booking.vendor_user_id if closing_side_is_client else booking.client_user_id
        if other_user_id and other_user_id != user_id:
            await notices.dispatch_booking_notification(
                session,
                mailer,
                user_id=other_user_id,
                booking_id=booking.id,
                kind=f"booking_cancelled_by_{closing_side}",
                body=CLOSED_ACCOUNT_CANCEL_BODY,
            )
        announce_change(session, booking)
    return cancelled_count


async def erase_client_booking_extras(session: AsyncSession, client_user_id: str) -> None:
    """Clear the closing client's notes and search context, and unlink their planner events."""
    await repository.erase_client_booking_extras(session, client_user_id)
