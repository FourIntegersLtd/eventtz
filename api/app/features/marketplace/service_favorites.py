"""A client's saved vendors: list, save, unsave, and merge the ones saved while signed out."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.features.marketplace import repository


async def saved_vendor_ids(session: AsyncSession, client: Principal) -> list[str]:
    """The client's saved vendor ids, most recently saved first."""
    return await repository.saved_vendor_ids(session, client.id)


async def save_vendor(session: AsyncSession, client: Principal, vendor_user_id: str) -> bool:
    """Save a vendor (saving twice is fine). False when the id is not a known user."""
    return await repository.save_vendor(
        session, client_user_id=client.id, vendor_user_id=vendor_user_id.strip()
    )


async def unsave_vendor(session: AsyncSession, client: Principal, vendor_user_id: str) -> bool:
    """Remove a saved vendor. True even when it was not saved; False only for a malformed id."""
    return await repository.unsave_vendor(
        session, client_user_id=client.id, vendor_user_id=vendor_user_id.strip()
    )


async def merge_saved_vendors(session: AsyncSession, client: Principal, vendor_user_ids: list[str]) -> int:
    """Save every non-blank id from the signed-out list; returns how many saves worked.

    Ids already saved count as merged (saving twice is not an error).
    """
    merged = 0
    for vendor_user_id in vendor_user_ids:
        if vendor_user_id.strip() and await repository.save_vendor(
            session, client_user_id=client.id, vendor_user_id=vendor_user_id.strip()
        ):
            merged += 1
    return merged
