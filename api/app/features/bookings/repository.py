"""Database access for bookings. The only file in `bookings` that queries.

Every function takes the request's session and never commits (ADR 0002). State
changes are conditional updates (`status` must still be what the caller read), so
two racing requests cannot both win; each returns whether a row changed.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import (
    DateTime,
    Integer,
    Text,
    Uuid,
    cast,
    column,
    exists,
    func,
    insert,
    select,
    table,
    update,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.bookings import domain
from app.features.bookings.models import BookingRequest
from app.features.bookings.rows import BookingRow, ClientReviewRow, VendorReviewRow

BOOKING_COLUMNS = (
    BookingRequest.id,
    BookingRequest.client_user_id,
    BookingRequest.vendor_user_id,
    BookingRequest.status,
    BookingRequest.payment_status,
    BookingRequest.initiator,
    BookingRequest.event_name,
    BookingRequest.event_date,
    BookingRequest.event_end_date,
    BookingRequest.event_postcode,
    BookingRequest.event_address,
    BookingRequest.notes,
    BookingRequest.total_label,
    BookingRequest.initial_client_total_label,
    BookingRequest.selected_option_ids,
    BookingRequest.line_items,
    BookingRequest.vendor_adjustments,
    BookingRequest.service_fee_percent,
    BookingRequest.vendor_referral_code,
    BookingRequest.conversation_id,
    BookingRequest.event_id,
    BookingRequest.created_at,
    BookingRequest.updated_at,
    BookingRequest.paid_at,
    BookingRequest.client_completion_confirmed_at,
    BookingRequest.vendor_completion_confirmed_at,
    BookingRequest.stripe_checkout_session_id,
    BookingRequest.stripe_payment_intent_id,
    BookingRequest.stripe_charge_id,
    BookingRequest.stripe_transfer_id,
    BookingRequest.stripe_receipt_url,
    BookingRequest.payment_amount_gbp,
    BookingRequest.vendor_amount_gbp,
    BookingRequest.platform_fee_gbp,
    BookingRequest.referral_fee_discount_gbp,
    BookingRequest.payout_released_at,
    BookingRequest.payout_auto_released_at,
    BookingRequest.completion_reminder_sent_at,
    BookingRequest.completed_at,
    BookingRequest.refunded_at,
    BookingRequest.cancelled_by,
    BookingRequest.support_hold,
)

# Reviews and disputes belong to slices not rebuilt yet; these handles read their tables.
_booking_reviews = table(
    "booking_reviews",
    column("id", Uuid),
    column("booking_request_id", Uuid),
    column("vendor_user_id", Uuid),
    column("client_user_id", Uuid),
    column("rating", Integer),
    column("body", Text),
    column("created_at", DateTime(timezone=True)),
    column("hidden_at", DateTime(timezone=True)),
    column("image_urls", ARRAY(Text)),
)
_dispute_cases = table(
    "dispute_cases",
    column("booking_request_id", Uuid),
    column("status", Text),
)
# Dispute states that block cancelling the booking.
_ACTIVE_DISPUTE_STATUSES = ("open", "under_review")


def _party_filters(*, client_user_id: str | None, vendor_user_id: str | None) -> list[Any]:
    """WHERE clauses limiting bookings to the given client and/or vendor."""
    filters: list[Any] = []
    if client_user_id is not None:
        filters.append(BookingRequest.client_user_id == as_uuid(client_user_id))
    if vendor_user_id is not None:
        filters.append(BookingRequest.vendor_user_id == as_uuid(vendor_user_id))
    return filters


# --- reads -------------------------------------------------------------------------------------------


async def get_booking(
    session: AsyncSession,
    booking_id: str,
    *,
    client_user_id: str | None = None,
    vendor_user_id: str | None = None,
) -> BookingRow | None:
    """The booking, if it exists and belongs to the given party; `None` otherwise."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return None
    result = await session.execute(
        select(*BOOKING_COLUMNS).where(
            BookingRequest.id == booking_uuid,
            *_party_filters(client_user_id=client_user_id, vendor_user_id=vendor_user_id),
        )
    )
    found = result.first()
    return BookingRow.model_validate(plain_row(found)) if found is not None else None


async def list_bookings(
    session: AsyncSession,
    *,
    client_user_id: str | None = None,
    vendor_user_id: str | None = None,
    statuses: tuple[str, ...] | None,
    status: str | None,
    payment_status: str | None,
    exclude_payment_status: str | None,
) -> list[BookingRow]:
    """The party's bookings in the given statuses, narrowed by the optional exact filters."""
    query = select(*BOOKING_COLUMNS).where(
        *_party_filters(client_user_id=client_user_id, vendor_user_id=vendor_user_id)
    )
    if statuses is not None:
        query = query.where(BookingRequest.status.in_(statuses))
    if status:
        query = query.where(BookingRequest.status == status)
    if payment_status:
        query = query.where(BookingRequest.payment_status == payment_status)
    if exclude_payment_status:
        query = query.where(BookingRequest.payment_status != exclude_payment_status)
    result = await session.execute(query.order_by(BookingRequest.created_at.desc()))
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def open_booking_dates(session: AsyncSession, vendor_user_id: str) -> list[tuple[str, str | None]]:
    """The first and last day of each of the vendor's pending or accepted bookings."""
    result = await session.execute(
        select(BookingRequest.event_date, BookingRequest.event_end_date).where(
            BookingRequest.vendor_user_id == as_uuid(vendor_user_id),
            BookingRequest.status.in_(("pending", "accepted")),
        )
    )
    return [
        (first_day.isoformat(), last_day.isoformat() if last_day is not None else None)
        for first_day, last_day in result
    ]


async def has_active_dispute(session: AsyncSession, booking_id: str) -> bool:
    """True when a problem report on the booking is open or under review."""
    result = await session.execute(
        select(
            exists().where(
                _dispute_cases.c.booking_request_id == as_uuid(booking_id),
                _dispute_cases.c.status.in_(_ACTIVE_DISPUTE_STATUSES),
            )
        )
    )
    return bool(result.scalar())


async def vendor_reviews(
    session: AsyncSession, vendor_user_id: str, booking_ids: list[str]
) -> dict[str, VendorReviewRow]:
    """The visible client review of each of these bookings, keyed by booking id."""
    booking_uuids = [parsed for parsed in (as_uuid(booking_id) for booking_id in booking_ids) if parsed]
    if not booking_uuids:
        return {}
    result = await session.execute(
        select(
            _booking_reviews.c.id,
            _booking_reviews.c.booking_request_id,
            _booking_reviews.c.client_user_id,
            _booking_reviews.c.rating,
            _booking_reviews.c.body,
            _booking_reviews.c.created_at,
            _booking_reviews.c.image_urls,
        ).where(
            _booking_reviews.c.vendor_user_id == as_uuid(vendor_user_id),
            _booking_reviews.c.booking_request_id.in_(booking_uuids),
            _booking_reviews.c.hidden_at.is_(None),
        )
    )
    reviews = [VendorReviewRow.model_validate(plain_row(found)) for found in result]
    return {review.booking_request_id: review for review in reviews}


async def client_review(
    session: AsyncSession, client_user_id: str, booking_id: str
) -> ClientReviewRow | None:
    """The review the client left on the booking (hidden or not), or `None`."""
    result = await session.execute(
        select(
            _booking_reviews.c.id,
            _booking_reviews.c.rating,
            _booking_reviews.c.body,
            _booking_reviews.c.created_at,
            _booking_reviews.c.image_urls,
        )
        .where(
            _booking_reviews.c.booking_request_id == as_uuid(booking_id),
            _booking_reviews.c.client_user_id == as_uuid(client_user_id),
        )
        .limit(1)
    )
    found = result.first()
    return ClientReviewRow.model_validate(plain_row(found)) if found is not None else None


async def reviewed_booking_ids(
    session: AsyncSession, client_user_id: str, booking_ids: list[str]
) -> set[str]:
    """Which of these bookings the client has reviewed."""
    booking_uuids = [parsed for parsed in (as_uuid(booking_id) for booking_id in booking_ids) if parsed]
    if not booking_uuids:
        return set()
    result = await session.execute(
        select(_booking_reviews.c.booking_request_id).where(
            _booking_reviews.c.client_user_id == as_uuid(client_user_id),
            _booking_reviews.c.booking_request_id.in_(booking_uuids),
        )
    )
    return {str(booking_uuid) for booking_uuid in result.scalars()}


# --- writes ------------------------------------------------------------------------------------------


async def insert_booking(session: AsyncSession, values: dict[str, Any]) -> BookingRow:
    """Store a new booking and return it.

    The daily-capacity trigger (migration 033) has the last word when two requests
    race for a vendor's last slot; its rejection becomes `VendorFullOnDate`. The
    savepoint keeps the request's transaction usable after that rejection.
    """
    row_values = {
        **values,
        "client_user_id": as_uuid(values["client_user_id"]),
        "vendor_user_id": as_uuid(values["vendor_user_id"]),
        "conversation_id": as_uuid(values.get("conversation_id")),
        "event_id": as_uuid(values.get("event_id")),
    }
    try:
        async with session.begin_nested():
            result = await session.execute(
                insert(BookingRequest).values(**row_values).returning(*BOOKING_COLUMNS)
            )
            created = result.one()
    except DBAPIError as error:
        mapped = domain.capacity_error_from_db(str(error.orig))
        if mapped is None:
            raise
        raise mapped from error
    return BookingRow.model_validate(plain_row(created))


async def update_booking(
    session: AsyncSession,
    booking_id: str,
    values: dict[str, Any],
    *,
    client_user_id: str | None = None,
    vendor_user_id: str | None = None,
    status_in: tuple[str, ...] | None = None,
    payment_status_in: tuple[str, ...] | None = None,
    unset_column: str | None = None,
    now_columns: tuple[str, ...] = (),
) -> bool:
    """Write `values` (and stamp `now_columns` with the database clock) on the party's booking.

    `status_in` / `payment_status_in` only update while the status / payment status
    is one of those; `unset_column` only while that column is still empty. Returns
    whether a row changed.
    """
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return False
    conditions = [
        BookingRequest.id == booking_uuid,
        *_party_filters(client_user_id=client_user_id, vendor_user_id=vendor_user_id),
    ]
    if status_in is not None:
        conditions.append(BookingRequest.status.in_(status_in))
    if payment_status_in is not None:
        conditions.append(BookingRequest.payment_status.in_(payment_status_in))
    if unset_column is not None:
        conditions.append(getattr(BookingRequest, unset_column).is_(None))
    stamped = {column_name: func.now() for column_name in now_columns}
    for id_column in ("conversation_id", "event_id"):
        if id_column in values:
            values = {**values, id_column: as_uuid(values[id_column])}
    result = await session.execute(
        update(BookingRequest).where(*conditions).values(**values, **stamped).returning(BookingRequest.id)
    )
    return result.first() is not None


async def stamp_first_response(session: AsyncSession, booking_id: str) -> None:
    """Record when the vendor first answered and how long the client waited (set once)."""
    waited_seconds = func.greatest(
        0, cast(func.floor(func.extract("epoch", func.now() - BookingRequest.created_at)), Integer)
    )
    await session.execute(
        update(BookingRequest)
        .where(BookingRequest.id == as_uuid(booking_id), BookingRequest.vendor_first_response_at.is_(None))
        .values(vendor_first_response_at=func.now(), vendor_response_time_seconds=waited_seconds)
    )
