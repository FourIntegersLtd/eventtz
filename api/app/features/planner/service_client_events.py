"""The client's events list and detail: what a plan turns into once it's real.

Booking counts are read live from `bookings` (a cross-slice repository read, see
`repository.booking_counts_by_event`) so a card's numbers never go stale.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.planner import repository
from app.features.planner.errors import ClientEventNotFound, InvalidEventId, InvalidStatusFilter
from app.features.planner.schemas import (
    ClientEventDetail,
    ClientEventDetailResponse,
    ClientEventListResponse,
    ClientEventSummary,
)

_STATUS_FILTERS = frozenset({"active", "archived", "all"})


async def list_client_events(
    session: AsyncSession, client_user_id: str, *, status: str
) -> ClientEventListResponse:
    """The client's own events, scoped by `status` (active, archived or all)."""
    if status not in _STATUS_FILTERS:
        raise InvalidStatusFilter
    events = await repository.list_client_events(session, client_user_id, status_filter=status)
    counts = await repository.booking_counts_by_event(session, client_user_id, [event.id for event in events])
    summaries = []
    for event in events:
        booking_count, active_booking_count = counts.get(event.id, (0, 0))
        summaries.append(
            ClientEventSummary(
                id=event.id,
                title=event.title,
                event_date=event.event_date,
                event_end_date=event.event_end_date,
                event_address=event.event_address,
                event_postcode=event.event_postcode,
                status=event.status,
                booking_count=booking_count,
                active_booking_count=active_booking_count,
                updated_at=event.updated_at or "",
            )
        )
    return ClientEventListResponse(events=summaries)


async def get_client_event(
    session: AsyncSession, client_user_id: str, event_id: str
) -> ClientEventDetailResponse:
    """One of the client's own events, in full. Rejects a malformed id before any lookup."""
    try:
        uuid.UUID(event_id)
    except ValueError as error:
        raise InvalidEventId from error
    event = await repository.get_client_event(session, client_user_id, event_id)
    if event is None:
        raise ClientEventNotFound
    counts = await repository.booking_counts_by_event(session, client_user_id, [event.id])
    booking_count, active_booking_count = counts.get(event.id, (0, 0))
    return ClientEventDetailResponse(
        event=ClientEventDetail(
            id=event.id,
            title=event.title,
            event_date=event.event_date,
            event_end_date=event.event_end_date,
            event_address=event.event_address,
            event_postcode=event.event_postcode,
            status=event.status,
            booking_count=booking_count,
            active_booking_count=active_booking_count,
            created_at=event.created_at or "",
        )
    )
