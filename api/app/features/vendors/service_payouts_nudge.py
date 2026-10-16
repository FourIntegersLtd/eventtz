"""The one "set up payouts" nudge sent to an approved vendor 24 hours after approval."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.vendors import repository
from app.features.vendors.rows import VendorRow

# How long after approval a vendor without ready payouts waits for the nudge.
PAYOUTS_NUDGE_AFTER = timedelta(hours=24)


async def vendors_awaiting_payouts_nudge(
    session: AsyncSession, *, now: datetime, limit: int
) -> list[VendorRow]:
    """Approved vendors, oldest approval first, approved 24h ago or more, never nudged, payouts not ready."""
    return await repository.payouts_nudge_candidates(
        session, approved_before=now - PAYOUTS_NUDGE_AFTER, limit=limit
    )


async def claim_payouts_nudge(session: AsyncSession, vendor_user_id: str) -> bool:
    """Claim the vendor's single nudge before sending it; False when it was already claimed."""
    return await repository.claim_payouts_nudge(session, vendor_user_id)


def nudge_business_name(vendor: VendorRow) -> str | None:
    """The business name for the greeting (trimmed), or `None` so the email falls back to the address."""
    raw_name = vendor.payload.get("businessName")
    return raw_name.strip() if isinstance(raw_name, str) and raw_name.strip() else None
