"""The one-off emails nudging an approved vendor: set up payouts (24h after approval), and upload
or renew public liability insurance (once per checked certificate)."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.vendors import repository
from app.features.vendors.rows import VendorRow as VendorRow  # re-exported for other slices (slice guard)
from app.features.vendors.schemas import VendorInsuranceState
from app.features.vendors.service_profile import insurance_state

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


async def vendors_awaiting_insurance_reminder(
    session: AsyncSession, *, today: date, limit: int
) -> list[VendorRow]:
    """Approved vendors needing cover, not emailed this cycle, none checked or cover ending in 30 days."""
    return await repository.insurance_reminder_candidates(session, today=today, limit=limit)


async def claim_insurance_reminder(session: AsyncSession, vendor_user_id: str) -> bool:
    """Claim this cycle's insurance email before sending it; False when it was already claimed."""
    return await repository.claim_insurance_reminder(session, vendor_user_id)


def vendor_insurance(vendor: VendorRow, *, today: date) -> VendorInsuranceState:
    """The vendor's cover, for the email's dates."""
    return insurance_state(vendor, today=today)
