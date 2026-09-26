"""Database access for client events. The only file in `planner` that queries.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.planner.models import ClientEvent
from app.features.planner.rows import ClientEventRow

_EVENT_COLUMNS = (
    ClientEvent.id,
    ClientEvent.client_user_id,
    ClientEvent.title,
    ClientEvent.event_date,
    ClientEvent.event_end_date,
    ClientEvent.event_address,
    ClientEvent.event_postcode,
    ClientEvent.status,
    ClientEvent.created_at,
    ClientEvent.updated_at,
)


async def get_client_event(
    session: AsyncSession, client_user_id: str, event_id: str
) -> ClientEventRow | None:
    """The client's own event with this id, or `None` (also for a malformed id)."""
    event_uuid = as_uuid(event_id)
    client_uuid = as_uuid(client_user_id)
    if event_uuid is None or client_uuid is None:
        return None
    result = await session.execute(
        select(*_EVENT_COLUMNS)
        .where(ClientEvent.id == event_uuid, ClientEvent.client_user_id == client_uuid)
        .limit(1)
    )
    found = result.first()
    return ClientEventRow.model_validate(plain_row(found)) if found is not None else None


async def insert_client_event(
    session: AsyncSession,
    *,
    client_user_id: str,
    title: str,
    event_date: date,
    event_end_date: date | None,
    event_address: str | None,
    event_postcode: str | None,
) -> ClientEventRow:
    """Store a new active event and return it."""
    result = await session.execute(
        insert(ClientEvent)
        .values(
            client_user_id=as_uuid(client_user_id),
            title=title,
            event_date=event_date,
            event_end_date=event_end_date,
            event_address=event_address,
            event_postcode=event_postcode,
            status="active",
        )
        .returning(*_EVENT_COLUMNS)
    )
    return ClientEventRow.model_validate(plain_row(result.one()))


async def touch_event(session: AsyncSession, event_id: str) -> None:
    """Move the event's `updated_at` to now, so it sorts as recently active."""
    event_uuid = as_uuid(event_id)
    if event_uuid is None:
        return
    await session.execute(
        update(ClientEvent).where(ClientEvent.id == event_uuid).values(updated_at=func.now())
    )


async def event_titles(session: AsyncSession, event_ids: list[str]) -> dict[str, str]:
    """Map each event id to its title; unknown ids are left out."""
    event_uuids = [event_uuid for event_uuid in (as_uuid(event_id) for event_id in event_ids) if event_uuid]
    if not event_uuids:
        return {}
    result = await session.execute(
        select(ClientEvent.id, ClientEvent.title).where(ClientEvent.id.in_(event_uuids))
    )
    return {str(event_uuid): title or "" for event_uuid, title in result}
