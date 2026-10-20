"""Database access for reviews. The only file in `reviews` that queries.

`booking_requests` belongs to the bookings slice; this repository reads it
through a plain `sqlalchemy.table()` handle (the pattern `bookings/repository.py`
uses for `booking_reviews`), never through bookings' models or repository.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Date, Text, Uuid, column, func, insert, select, table, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.db import as_uuid, plain_row
from app.features.reviews.models import BookingReview
from app.features.reviews.rows import ReviewedBookingRow, ReviewRow, VendorReviewStatsRow

# Bookings owns this table; reviews only reads the columns a review needs from it.
_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("client_user_id", Uuid),
    column("vendor_user_id", Uuid),
    column("status", Text),
    column("event_name", Text),
    column("event_date", Date),
    column("total_label", Text),
)

_REVIEW_COLUMNS = (
    BookingReview.id,
    BookingReview.booking_request_id,
    BookingReview.vendor_user_id,
    BookingReview.client_user_id,
    BookingReview.rating,
    BookingReview.body,
    BookingReview.created_at,
    BookingReview.hidden_at,
    BookingReview.image_urls,
)


def _review_row(found: Any) -> ReviewRow:
    """One query result row as a `ReviewRow`."""
    return ReviewRow.model_validate(plain_row(found))


# --- the booking a review is about --------------------------------------------------------------


async def booking_for_review(session: AsyncSession, booking_id: str) -> ReviewedBookingRow | None:
    """The booking's ownership, status and event context, or `None` for a bad or missing id."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return None
    result = await session.execute(
        select(
            _booking_requests.c.id,
            _booking_requests.c.client_user_id,
            _booking_requests.c.vendor_user_id,
            _booking_requests.c.status,
            _booking_requests.c.event_name,
            _booking_requests.c.event_date,
            _booking_requests.c.total_label,
        ).where(_booking_requests.c.id == booking_uuid)
    )
    found = result.first()
    return ReviewedBookingRow.model_validate(plain_row(found)) if found is not None else None


async def event_context_by_booking_id(
    session: AsyncSession, booking_ids: list[str]
) -> dict[str, ReviewedBookingRow]:
    """The event name, date and total label of each of these bookings, keyed by booking id."""
    booking_uuids = [parsed for parsed in (as_uuid(booking_id) for booking_id in booking_ids) if parsed]
    if not booking_uuids:
        return {}
    result = await session.execute(
        select(
            _booking_requests.c.id,
            _booking_requests.c.client_user_id,
            _booking_requests.c.vendor_user_id,
            _booking_requests.c.status,
            _booking_requests.c.event_name,
            _booking_requests.c.event_date,
            _booking_requests.c.total_label,
        ).where(_booking_requests.c.id.in_(booking_uuids))
    )
    context_rows = [ReviewedBookingRow.model_validate(plain_row(found)) for found in result]
    return {context_row.id: context_row for context_row in context_rows}


# --- reads on booking_reviews --------------------------------------------------------------------


async def review_exists_for_booking(session: AsyncSession, booking_id: str) -> bool:
    """Whether the booking already has a review (`booking_request_id` is `UNIQUE`)."""
    result = await session.execute(
        select(BookingReview.id).where(BookingReview.booking_request_id == as_uuid(booking_id)).limit(1)
    )
    return result.first() is not None


async def reviews_for_client(session: AsyncSession, client_user_id: str, *, limit: int) -> list[ReviewRow]:
    """Every review this client has submitted, most recent first."""
    result = await session.execute(
        select(*_REVIEW_COLUMNS)
        .where(BookingReview.client_user_id == as_uuid(client_user_id))
        .order_by(BookingReview.created_at.desc())
        .limit(limit)
    )
    return [_review_row(found) for found in result]


async def visible_reviews_for_vendor(
    session: AsyncSession, vendor_user_id: str, *, limit: int
) -> list[ReviewRow]:
    """The vendor's visible (not hidden) reviews, most recent first - matches their public profile."""
    rows, _total = await visible_reviews_for_vendor_page(
        session, vendor_user_id, min_rating=None, offset=0, limit=limit
    )
    return rows


async def visible_reviews_for_vendor_page(
    session: AsyncSession,
    vendor_user_id: str,
    *,
    min_rating: int | None,
    offset: int,
    limit: int,
) -> tuple[list[ReviewRow], int]:
    """Visible reviews for the vendor owner list, optionally filtered by minimum rating."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return [], 0
    filters: list[ColumnElement[bool]] = [
        BookingReview.vendor_user_id == vendor_uuid,
        BookingReview.hidden_at.is_(None),
    ]
    if min_rating is not None:
        filters.append(BookingReview.rating >= min_rating)
    base = tuple(filters)
    total = (await session.execute(select(func.count(BookingReview.id)).where(*base))).scalar_one()
    result = await session.execute(
        select(*_REVIEW_COLUMNS)
        .where(*base)
        .order_by(BookingReview.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [_review_row(found) for found in result], int(total)


async def visible_five_star_count_for_vendor(session: AsyncSession, vendor_user_id: str) -> int:
    """How many visible 5-star reviews the vendor has (for dashboard KPIs)."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return 0
    return int(
        (
            await session.execute(
                select(func.count(BookingReview.id)).where(
                    BookingReview.vendor_user_id == vendor_uuid,
                    BookingReview.hidden_at.is_(None),
                    BookingReview.rating >= 5,
                )
            )
        ).scalar_one()
        or 0
    )


async def visible_review_stats_for_vendor(session: AsyncSession, vendor_user_id: str) -> VendorReviewStatsRow:
    """The vendor's visible-review count and average rating (matches `vendor_review_stats`)."""
    result = await session.execute(
        select(func.count(BookingReview.id), func.avg(BookingReview.rating)).where(
            BookingReview.vendor_user_id == as_uuid(vendor_user_id),
            BookingReview.hidden_at.is_(None),
        )
    )
    review_count, average_rating = result.one()
    return VendorReviewStatsRow(
        review_count=int(review_count or 0),
        average_rating=round(float(average_rating), 2) if average_rating is not None else None,
    )


async def all_reviews_for_admin(
    session: AsyncSession,
    *,
    offset: int,
    limit: int,
    vendor_user_id: str | None,
    visibility: str = "all",
) -> tuple[list[ReviewRow], int]:
    """Every review (hidden included), most recent first, optionally narrowed to one vendor."""
    conditions = []
    if vendor_user_id:
        vendor_uuid = as_uuid(vendor_user_id)
        # An unparsable id names no vendor, so the filter matches nothing (not everything).
        conditions.append(BookingReview.vendor_user_id == vendor_uuid)
    if visibility == "published":
        conditions.append(BookingReview.hidden_at.is_(None))
    elif visibility == "hidden":
        conditions.append(BookingReview.hidden_at.is_not(None))
    total = (await session.execute(select(func.count(BookingReview.id)).where(*conditions))).scalar_one()
    result = await session.execute(
        select(*_REVIEW_COLUMNS)
        .where(*conditions)
        .order_by(BookingReview.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [_review_row(found) for found in result], int(total)


async def review_for_admin(session: AsyncSession, review_id: str) -> ReviewRow | None:
    """One review (hidden or not), for the admin detail screen."""
    review_uuid = as_uuid(review_id)
    if review_uuid is None:
        return None
    result = await session.execute(select(*_REVIEW_COLUMNS).where(BookingReview.id == review_uuid))
    found = result.first()
    return _review_row(found) if found is not None else None


# --- writes ---------------------------------------------------------------------------------------


async def insert_review(session: AsyncSession, values: dict[str, Any]) -> ReviewRow:
    """Store a new review and return it as saved (so the response reflects any column defaults)."""
    row_values = {
        **values,
        "booking_request_id": as_uuid(values["booking_request_id"]),
        "vendor_user_id": as_uuid(values["vendor_user_id"]),
        "client_user_id": as_uuid(values["client_user_id"]),
    }
    result = await session.execute(insert(BookingReview).values(**row_values).returning(*_REVIEW_COLUMNS))
    return _review_row(result.one())


async def set_hidden(session: AsyncSession, review_id: str, *, hidden: bool) -> None:
    """Set or clear `hidden_at`. Matches zero rows silently, like the baseline's Supabase update."""
    review_uuid = as_uuid(review_id)
    if review_uuid is None:
        return
    stamp = datetime.now(UTC) if hidden else None
    await session.execute(
        update(BookingReview).where(BookingReview.id == review_uuid).values(hidden_at=stamp)
    )
