"""Vendors as the public marketplace sees them. Other slices read listings only through here.

The listing rule itself is `domain_visibility.is_publicly_listable`; the repository
repeats it in SQL so the database does the filtering.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.vendors import repository
from app.features.vendors.domain_insurance import has_valid_insurance
from app.features.vendors.domain_profile_form import vendor_display_name
from app.features.vendors.rows import ListedVendorRow
from app.features.vendors.schemas import ListedVendor

# The baseline capped an id filter at 500 ids; kept so a huge favourites list stays bounded.
MAX_FILTER_IDS = 500


# The form key the web app reads for the "insurance checked" badge. The vendor can type any key
# into their form, so the listing always overwrites this one with what staff checked.
INSURANCE_CHECKED_UNTIL_KEY = "insuranceCheckedUntil"


def _public_payload(row: ListedVendorRow, today: date) -> dict[str, Any]:
    """The form as the public sees it, with the badge key set only for checked, in-date cover."""
    payload = {key: value for key, value in row.payload.items() if key != INSURANCE_CHECKED_UNTIL_KEY}
    if has_valid_insurance(row.insurance_expires_on, today=today) and row.insurance_expires_on is not None:
        payload[INSURANCE_CHECKED_UNTIL_KEY] = row.insurance_expires_on.isoformat()
    return payload


def _listed(rows: list[ListedVendorRow]) -> list[ListedVendor]:
    """The public view of repository rows."""
    today = datetime.now(UTC).date()
    return [
        ListedVendor.model_validate(
            {**row.model_dump(exclude={"insurance_expires_on"}), "payload": _public_payload(row, today)}
        )
        for row in rows
    ]


async def listed_vendors(
    session: AsyncSession,
    *,
    country_code: str,
    user_ids: list[str] | None = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
    service_types: list[str] | None = None,
    city_query: str | None = None,
) -> list[ListedVendor]:
    """Publicly listed vendors in one market, newest first, narrowed by the optional filters.

    `city_query` is matched case-insensitively anywhere in the vendor's base city.
    """
    city = (city_query or "").strip().lower() or None
    rows = await repository.marketplace_vendors(
        session,
        listed_only=True,
        country_code=country_code,
        user_ids=user_ids[:MAX_FILTER_IDS] if user_ids else None,
        budget_min=budget_min,
        budget_max=budget_max,
        service_types=service_types or None,
        city_query=city,
    )
    return _listed(rows)


async def listed_vendor(session: AsyncSession, user_id: str) -> ListedVendor | None:
    """One publicly listed vendor in any market, or `None`."""
    rows = await repository.marketplace_vendors(session, listed_only=True, user_ids=[user_id])
    return _listed(rows)[0] if rows else None


async def approved_vendors(
    session: AsyncSession, *, user_ids: list[str], country_code: str | None
) -> list[ListedVendor]:
    """Approved vendors among `user_ids`, listed or not (for staff-designated QA vendors).

    With `country_code` as `None` every market matches.
    """
    if not user_ids:
        return []
    rows = await repository.marketplace_vendors(
        session, listed_only=False, country_code=country_code, user_ids=user_ids[:MAX_FILTER_IDS]
    )
    return _listed(rows)


async def display_names(session: AsyncSession, user_ids: list[str]) -> dict[str, str]:
    """Map each vendor with a profile to the name others see. Vendors without one are left out."""
    return {
        found.user_id: vendor_display_name(found.payload, deleted=found.deleted)
        for found in await repository.vendor_name_rows(session, user_ids)
    }
