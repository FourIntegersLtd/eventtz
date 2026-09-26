"""What bookings needs from the planner: the event a new booking belongs to, and event titles.

A client booking always hangs off an event: the one the client picked, or a new
one made from the booking's own name, dates and venue.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.planner import repository
from app.features.planner.errors import EventArchived, EventNotFound


@dataclass(frozen=True)
class BookingEventFields:
    """The event a booking belongs to, and the event columns the booking row copies from it."""

    event_id: str
    event_name: str
    event_date: date
    event_end_date: date | None
    event_postcode: str | None
    event_address: str | None


async def resolve_event_for_booking(
    session: AsyncSession,
    client_user_id: str,
    *,
    event_id: str | None,
    event_name: str,
    event_date: date,
    event_end_date: date | None,
    event_address: str | None,
    event_postcode: str | None,
) -> BookingEventFields:
    """The picked event's details (its own values win), or a new event made from the booking."""
    picked_id = (event_id or "").strip()
    if picked_id:
        existing = await repository.get_client_event(session, client_user_id, picked_id)
        if existing is None:
            raise EventNotFound()
        if existing.status == "archived":
            raise EventArchived()
        stored_end = date.fromisoformat(existing.event_end_date[:10]) if existing.event_end_date else None
        return BookingEventFields(
            event_id=existing.id,
            event_name=(existing.title or event_name).strip(),
            event_date=date.fromisoformat(existing.event_date[:10]) if existing.event_date else event_date,
            event_end_date=stored_end or event_end_date,
            event_postcode=existing.event_postcode or event_postcode,
            event_address=existing.event_address or event_address,
        )
    postcode = event_postcode.strip() if event_postcode else None
    address = event_address.strip() if event_address else None
    created = await repository.insert_client_event(
        session,
        client_user_id=client_user_id,
        title=event_name.strip(),
        event_date=event_date,
        event_end_date=event_end_date,
        event_address=address,
        event_postcode=postcode,
    )
    return BookingEventFields(
        event_id=created.id,
        event_name=event_name.strip(),
        event_date=event_date,
        event_end_date=event_end_date,
        event_postcode=postcode,
        event_address=address,
    )


async def touch_event(session: AsyncSession, event_id: str | None) -> None:
    """Mark the event as just active (a booking was added to it)."""
    if event_id:
        await repository.touch_event(session, event_id)


async def event_titles(session: AsyncSession, event_ids: list[str]) -> dict[str, str]:
    """Map each event id to its title."""
    return await repository.event_titles(session, [event_id for event_id in event_ids if event_id])
