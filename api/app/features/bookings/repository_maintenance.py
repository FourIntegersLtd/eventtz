"""Database reads and writes of the hourly booking maintenance (reminders, auto payouts, stale enquiries).

Like `repository.py`, every function takes the caller's session and never commits;
writes are conditional so two overlapping runs cannot both act on one booking.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.bookings.models import BookingRequest
from app.features.bookings.repository import BOOKING_COLUMNS
from app.features.bookings.rows import BookingRow, EnquiryReminderRow

# The enquiry reminder stamp columns the job may write (anything else is refused).
_REMINDER_STAMP_COLUMNS = frozenset(
    {"enquiry_reminder_1h_at", "enquiry_reminder_6h_at", "enquiry_reminder_24h_at"}
)
# How many stale enquiries one run marks at most (the baseline's limit).
_STALE_ENQUIRY_BATCH_LIMIT = 500


async def paid_bookings_without(session: AsyncSession, unset_column: str, *, limit: int) -> list[BookingRow]:
    """Accepted, paid bookings whose `unset_column` is still empty (the caller checks the event day).

    `unset_column` is `completion_reminder_sent_at` or `payout_auto_released_at`: the
    step that stamps it has not run for these bookings yet. Earliest events come first,
    so bookings whose event is still ahead cannot crowd out the ones that are due.
    """
    result = await session.execute(
        select(*BOOKING_COLUMNS)
        .where(
            BookingRequest.status == "accepted",
            BookingRequest.payment_status == "paid",
            getattr(BookingRequest, unset_column).is_(None),
        )
        .order_by(BookingRequest.event_date, BookingRequest.id)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def mark_stale_enquiries(
    session: AsyncSession, *, failure_reason: str, created_before: datetime
) -> int:
    """Stamp `failure_reason` on pending client enquiries sent before `created_before`; returns how many.

    Only rows with no failure reason yet are touched, so a later run never overwrites one.
    """
    stale_ids = (
        select(BookingRequest.id)
        .where(
            BookingRequest.status == "pending",
            BookingRequest.initiator == "client",
            BookingRequest.failure_reason.is_(None),
            BookingRequest.created_at < created_before,
        )
        .limit(_STALE_ENQUIRY_BATCH_LIMIT)
        .scalar_subquery()
    )
    result = await session.execute(
        update(BookingRequest)
        .where(
            BookingRequest.id.in_(stale_ids),
            BookingRequest.status == "pending",
            BookingRequest.failure_reason.is_(None),
        )
        .values(failure_reason=failure_reason, failure_noted_at=func.now())
        .returning(BookingRequest.id)
    )
    return len(result.all())


async def unanswered_enquiries(session: AsyncSession, *, limit: int) -> list[EnquiryReminderRow]:
    """Pending client enquiries the vendor has not replied to, oldest first."""
    result = await session.execute(
        select(
            BookingRequest.id,
            BookingRequest.vendor_user_id,
            BookingRequest.event_name,
            BookingRequest.created_at,
            BookingRequest.enquiry_reminder_1h_at,
            BookingRequest.enquiry_reminder_6h_at,
            BookingRequest.enquiry_reminder_24h_at,
        )
        .where(
            BookingRequest.status == "pending",
            BookingRequest.initiator == "client",
            BookingRequest.vendor_first_response_at.is_(None),
        )
        .order_by(BookingRequest.created_at)
        .limit(limit)
    )
    return [EnquiryReminderRow.model_validate(plain_row(found)) for found in result]


async def stamp_enquiry_reminders(session: AsyncSession, booking_id: str, stamp_columns: list[str]) -> None:
    """Record that these enquiry reminders were sent (or skipped for a vendor who left) just now."""
    unknown_columns = set(stamp_columns) - _REMINDER_STAMP_COLUMNS
    if unknown_columns:
        raise ValueError(f"not an enquiry reminder column: {sorted(unknown_columns)}")
    if not stamp_columns:
        return
    await session.execute(
        update(BookingRequest)
        .where(BookingRequest.id == as_uuid(booking_id))
        .values(**{stamp_column: func.now() for stamp_column in stamp_columns})
    )
