"""Database access for the tables this slice owns: saved vendors and the funnel event log.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid
from app.features.marketplace.models import ClientSavedVendor, MarketplaceEvent


async def saved_vendor_ids(session: AsyncSession, client_user_id: str) -> list[str]:
    """The vendors a client has saved, most recently saved first."""
    client_id = as_uuid(client_user_id)
    if client_id is None:
        return []
    result = await session.execute(
        select(ClientSavedVendor.vendor_user_id)
        .where(ClientSavedVendor.client_user_id == client_id)
        .order_by(ClientSavedVendor.created_at.desc(), ClientSavedVendor.id.desc())
    )
    return [str(vendor_id) for vendor_id in result.scalars()]


async def save_vendor(session: AsyncSession, *, client_user_id: str, vendor_user_id: str) -> bool:
    """Save a vendor for a client (saving twice is fine). False when either id names no account."""
    client_id, vendor_id = as_uuid(client_user_id), as_uuid(vendor_user_id)
    if client_id is None or vendor_id is None:
        return False
    try:
        async with session.begin_nested():
            await session.execute(
                insert(ClientSavedVendor)
                .values(client_user_id=client_id, vendor_user_id=vendor_id)
                .on_conflict_do_nothing(index_elements=["client_user_id", "vendor_user_id"])
            )
    except IntegrityError:
        # The vendor id is well formed but names no account (foreign key).
        return False
    return True


async def unsave_vendor(session: AsyncSession, *, client_user_id: str, vendor_user_id: str) -> bool:
    """Remove a saved vendor (a no-op when it was never saved). False only for a malformed id."""
    client_id, vendor_id = as_uuid(client_user_id), as_uuid(vendor_user_id)
    if client_id is None or vendor_id is None:
        return False
    await session.execute(
        delete(ClientSavedVendor).where(
            ClientSavedVendor.client_user_id == client_id, ClientSavedVendor.vendor_user_id == vendor_id
        )
    )
    return True


async def insert_event(session: AsyncSession, values: dict[str, Any]) -> bool:
    """Append a funnel event; False (and nothing written) when the database rejects it."""
    row = {
        **values,
        "actor_user_id": as_uuid(values.get("actor_user_id")),
        "vendor_user_id": as_uuid(values.get("vendor_user_id")),
        "booking_request_id": as_uuid(values.get("booking_request_id")),
    }
    try:
        async with session.begin_nested():
            session.add(MarketplaceEvent(**row))
            await session.flush()
    except IntegrityError:
        return False
    return True
