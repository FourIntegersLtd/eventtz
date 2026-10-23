"""Database reads and writes of the hourly booking maintenance (reminders, auto payouts, stale enquiries).

Like `repository.py`, every function takes the caller's session and never commits;
writes are conditional so two overlapping runs cannot both act on one booking.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionTransaction

from app.core.db import as_uuid, plain_row
from app.features.bookings.errors import UnknownReminderColumn
from app.features.bookings.models import BookingRequest
from app.features.bookings.repository import BOOKING_COLUMNS
from app.features.bookings.rows import BookingRow, EnquiryReminderRow, SilentEnquiryRow

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
        raise UnknownReminderColumn(f"not an enquiry reminder column: {sorted(unknown_columns)}")
    if not stamp_columns:
        return
    await session.execute(
        update(BookingRequest)
        .where(BookingRequest.id == as_uuid(booking_id))
        .values(**{stamp_column: func.now() for stamp_column in stamp_columns})
    )


def reminder_savepoint(session: AsyncSession) -> AsyncSessionTransaction:
    """A savepoint around one reminder, so a database error in it undoes only that reminder's claim."""
    return session.begin_nested()


async def silent_client_enquiries(
    session: AsyncSession, *, created_before: datetime, limit: int
) -> list[SilentEnquiryRow]:
    """Pending enquiries sent before `created_before`, never answered, whose client was not nudged."""
    result = await session.execute(
        select(
            BookingRequest.id,
            BookingRequest.client_user_id,
            BookingRequest.vendor_user_id,
            BookingRequest.event_name,
            BookingRequest.client_search_context,
        )
        .where(
            BookingRequest.status == "pending",
            BookingRequest.initiator == "client",
            BookingRequest.vendor_first_response_at.is_(None),
            BookingRequest.client_no_response_nudge_at.is_(None),
            BookingRequest.created_at <= created_before,
        )
        .order_by(BookingRequest.created_at)
        .limit(limit)
    )
    return [SilentEnquiryRow.model_validate(plain_row(found)) for found in result]


async def vendor_ids_contacted_by(session: AsyncSession, client_user_id: str, *, limit: int) -> set[str]:
    """The vendors this client has sent any request to (at most `limit` bookings are looked at)."""
    client_uuid = as_uuid(client_user_id)
    if client_uuid is None:
        return set()
    result = await session.execute(
        select(BookingRequest.vendor_user_id).where(BookingRequest.client_user_id == client_uuid).limit(limit)
    )
    return {str(vendor_user_id) for vendor_user_id in result.scalars()}


async def unpaid_accepted_bookings(
    session: AsyncSession, *, accepted_before: datetime, limit: int
) -> list[BookingRow]:
    """Accepted, unpaid bookings accepted before `accepted_before` whose pay-to-confirm reminder is unsent."""
    result = await session.execute(
        select(*BOOKING_COLUMNS)
        .where(
            BookingRequest.status == "accepted",
            BookingRequest.payment_status == "unpaid",
            BookingRequest.pay_to_confirm_reminded_at.is_(None),
            BookingRequest.accepted_at.is_not(None),
            BookingRequest.accepted_at <= accepted_before,
        )
        .order_by(BookingRequest.accepted_at, BookingRequest.id)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def paid_bookings_starting_on(
    session: AsyncSession, event_day: date, *, limit: int
) -> list[BookingRow]:
    """Accepted, paid bookings whose event starts on `event_day` and whose day-before reminder is unsent."""
    result = await session.execute(
        select(*BOOKING_COLUMNS)
        .where(
            BookingRequest.status == "accepted",
            BookingRequest.payment_status == "paid",
            BookingRequest.event_tomorrow_reminded_at.is_(None),
            BookingRequest.event_date == event_day,
        )
        .order_by(BookingRequest.id)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def bookings_awaiting_final_payout(
    session: AsyncSession, *, limit: int, after_id: str | None = None
) -> list[BookingRow]:
    """Completed, still-paid split bookings whose first part is out (the caller checks the deadline).

    Paged by id (`after_id`) so bookings that are not due yet never crowd out ones that are.
    """
    result = await session.execute(
        select(*BOOKING_COLUMNS)
        .where(
            BookingRequest.status == "completed",
            BookingRequest.payment_status == "paid",
            BookingRequest.upfront_payout_at.is_not(None),
            BookingRequest.support_hold.is_(False),
            *_after(after_id),
        )
        .order_by(BookingRequest.id)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def bookings_awaiting_payment(
    session: AsyncSession, *, limit: int, after_id: str | None = None
) -> list[BookingRow]:
    """Accepted bookings not yet paid (the payment-deadline rule).

    The caller works out each booking's deadline; this only narrows to the ones that can have one.
    """
    result = await session.execute(
        select(*BOOKING_COLUMNS)
        .where(
            BookingRequest.status == "accepted",
            BookingRequest.payment_status.in_(("unpaid", "pending")),
            BookingRequest.accepted_at.is_not(None),
            *_after(after_id),
        )
        .order_by(BookingRequest.id)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def bookings_holding_deposit(
    session: AsyncSession, *, limit: int, after_id: str | None = None
) -> list[BookingRow]:
    """Paid bookings whose deposit is still held and unclaimed (the caller checks the claim window)."""
    result = await session.execute(
        select(*BOOKING_COLUMNS)
        .where(
            BookingRequest.damage_deposit_gbp > 0,
            BookingRequest.paid_at.is_not(None),
            BookingRequest.deposit_refunded_at.is_(None),
            BookingRequest.deposit_claim_resolved_at.is_(None),
            BookingRequest.deposit_claimed_at.is_(None),
            BookingRequest.payment_status.in_(("paid", "payout_released", "partially_refunded")),
            *_after(after_id),
        )
        .order_by(BookingRequest.id)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def bookings_owing_deposit_remainder(session: AsyncSession, *, limit: int) -> list[BookingRow]:
    """Decided deposit claims whose refund of the rest to the client has not gone through yet."""
    result = await session.execute(
        select(*BOOKING_COLUMNS)
        .where(
            BookingRequest.damage_deposit_gbp > 0,
            BookingRequest.deposit_claim_resolved_at.is_not(None),
            BookingRequest.deposit_refunded_at.is_(None),
            BookingRequest.deposit_claim_awarded_gbp < BookingRequest.damage_deposit_gbp,
            BookingRequest.payment_status.in_(("paid", "payout_released", "partially_refunded")),
        )
        .order_by(BookingRequest.id)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


def _after(after_id: str | None) -> list[Any]:
    """The keyset filter for the next page: rows whose id sorts after `after_id` (none on page one)."""
    after_uuid = as_uuid(after_id) if after_id else None
    return [BookingRequest.id > after_uuid] if after_uuid is not None else []
