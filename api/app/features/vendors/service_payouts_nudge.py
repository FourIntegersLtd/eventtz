"""The one-off emails nudging an approved vendor: set up payouts (24h after approval) and
choose a cancellation policy (as soon as they are approved without one)."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.vendors import repository
from app.features.vendors.rows import VendorRow as VendorRow  # re-exported for other slices (slice guard)

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


# How long after the first cancellation-policy email the one follow-up goes out.
CANCELLATION_POLICY_REMINDER_AFTER = timedelta(days=14)


async def vendors_awaiting_cancellation_policy_nudge(session: AsyncSession, *, limit: int) -> list[VendorRow]:
    """Approved vendors, oldest first, never emailed, whose form has no cancellation preset yet."""
    return await repository.cancellation_policy_nudge_candidates(session, limit=limit)


async def vendors_awaiting_cancellation_policy_reminder(
    session: AsyncSession, *, now: datetime, limit: int
) -> list[VendorRow]:
    """Approved vendors emailed 14 days ago or more, not yet reminded, still without a preset."""
    return await repository.cancellation_policy_nudge_candidates(
        session, limit=limit, nudged_before=now - CANCELLATION_POLICY_REMINDER_AFTER
    )


async def claim_cancellation_policy_nudge(
    session: AsyncSession, vendor_user_id: str, *, follow_up: bool = False
) -> bool:
    """Claim the vendor's first email, or with `follow_up` the one reminder; False when already claimed."""
    return await repository.claim_cancellation_policy_nudge(session, vendor_user_id, follow_up=follow_up)
