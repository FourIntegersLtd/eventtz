"""The booking and dispute facts the feed shows, read through lightweight table handles.

`booking_requests` belongs to bookings and `dispute_cases` to disputes; neither is
rebuilt yet. These reads move behind those slices' services when they are.
Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from sqlalchemy import DateTime, Text, Uuid, column, or_, select, table
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.notifications.rows import DisputeNoticeRow

_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("client_user_id", Uuid),
    column("vendor_user_id", Uuid),
    column("event_name", Text),
)
_dispute_cases = table(
    "dispute_cases",
    column("id", Uuid),
    column("booking_request_id", Uuid),
    column("status", Text),
    column("summary", Text),
    column("created_at", DateTime(timezone=True)),
    column("updated_at", DateTime(timezone=True)),
)
# The most bookings one feed looks up event names for (the baseline's cap).
EVENT_NAME_LOOKUP_LIMIT = 100


async def event_names(session: AsyncSession, booking_ids: list[str]) -> dict[str, str]:
    """Each booking's event name, trimmed; bookings with a blank name are absent."""
    parsed_ids = [parsed for parsed in (as_uuid(booking_id) for booking_id in booking_ids) if parsed]
    if not parsed_ids:
        return {}
    result = await session.execute(
        select(_booking_requests.c.id, _booking_requests.c.event_name).where(
            _booking_requests.c.id.in_(parsed_ids[:EVENT_NAME_LOOKUP_LIMIT])
        )
    )
    names: dict[str, str] = {}
    for booking_id, event_name in result.tuples():
        trimmed = (event_name or "").strip()
        if trimmed:
            names[str(booking_id)] = trimmed
    return names


async def latest_disputes_for_party(
    session: AsyncSession, user_id: str, *, limit: int
) -> list[DisputeNoticeRow]:
    """Disputes on bookings where the user is the client or the vendor, most recently updated first."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return []
    result = await session.execute(
        select(
            _dispute_cases.c.status,
            _dispute_cases.c.summary,
            _dispute_cases.c.created_at,
            _dispute_cases.c.updated_at,
        )
        .join(_booking_requests, _booking_requests.c.id == _dispute_cases.c.booking_request_id)
        .where(
            or_(
                _booking_requests.c.client_user_id == parsed_id,
                _booking_requests.c.vendor_user_id == parsed_id,
            )
        )
        .order_by(
            _dispute_cases.c.updated_at.desc(), _dispute_cases.c.created_at.desc(), _dispute_cases.c.id.desc()
        )
        .limit(limit)
    )
    return [DisputeNoticeRow.model_validate(plain_row(row)) for row in result]
