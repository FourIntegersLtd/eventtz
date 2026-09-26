"""The two booking-request facts chat needs, read and written through a lightweight table handle.

`booking_requests` belongs to bookings, which is not rebuilt yet. These move
behind the bookings service when it is. Every function takes the request's
session and never commits (ADR 0002).
"""

from __future__ import annotations

from sqlalchemy import DateTime, Integer, Text, Uuid, cast, column, func, select, table, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid

_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("client_user_id", Uuid),
    column("vendor_user_id", Uuid),
    column("conversation_id", Uuid),
    column("status", Text),
    column("created_at", DateTime(timezone=True)),
    column("vendor_first_response_at", DateTime(timezone=True)),
    column("vendor_response_time_seconds", Integer),
)
# Requests a vendor's chat reply can still count as "first response" for.
_OPEN_FOR_RESPONSE = ("pending", "accepted", "declined")


async def has_booking_between(session: AsyncSession, *, vendor_user_id: str, client_user_id: str) -> bool:
    """True when the client has sent this vendor any booking request, in any state."""
    vendor_id, client_id = as_uuid(vendor_user_id), as_uuid(client_user_id)
    if vendor_id is None or client_id is None:
        return False
    found = await session.scalar(
        select(_booking_requests.c.id)
        .where(
            _booking_requests.c.vendor_user_id == vendor_id,
            _booking_requests.c.client_user_id == client_id,
        )
        .limit(1)
    )
    return found is not None


async def mark_vendor_first_response(
    session: AsyncSession, *, conversation_id: str, vendor_user_id: str
) -> str | None:
    """Stamp the vendor's first reply on the thread's newest open booking request.

    Only the first reply counts: a request that already has one keeps it. Returns
    the request's id (whether or not it was stamped), or `None` when the thread
    has no open request.
    """
    thread_id, vendor_id = as_uuid(conversation_id), as_uuid(vendor_user_id)
    if thread_id is None or vendor_id is None:
        return None
    booking_id = await session.scalar(
        select(_booking_requests.c.id)
        .where(
            _booking_requests.c.conversation_id == thread_id,
            _booking_requests.c.vendor_user_id == vendor_id,
            _booking_requests.c.status.in_(_OPEN_FOR_RESPONSE),
        )
        .order_by(_booking_requests.c.created_at.desc())
        .limit(1)
    )
    if booking_id is None:
        return None
    waited_seconds = func.greatest(
        0,
        cast(func.floor(func.extract("epoch", func.now() - _booking_requests.c.created_at)), Integer),
    )
    await session.execute(
        update(_booking_requests)
        .where(
            _booking_requests.c.id == booking_id,
            _booking_requests.c.vendor_first_response_at.is_(None),
        )
        .values(vendor_first_response_at=func.now(), vendor_response_time_seconds=waited_seconds)
    )
    return str(booking_id)
