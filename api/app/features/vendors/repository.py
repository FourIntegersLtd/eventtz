"""Database access for vendor profiles (the `vendors` table). The only file here that queries tables.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import ColumnElement, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.vendors.models import Vendor
from app.features.vendors.rows import VendorRow

_VENDOR_COLUMNS = (
    Vendor.id,
    Vendor.user_id,
    Vendor.status,
    Vendor.approval_status,
    Vendor.current_step,
    Vendor.payload,
    Vendor.created_at,
    Vendor.updated_at,
    Vendor.stripe_account_id,
    Vendor.stripe_charges_enabled,
    Vendor.stripe_payouts_enabled,
    Vendor.listing_override,
    Vendor.listing_override_reason,
)
# The unique index Postgres names when two vendors normalise to the same business name.
_BUSINESS_NAME_INDEX = "idx_vendors_business_name_normalized_unique"
# Search matches are capped so a one-letter search cannot pull the whole table.
SEARCH_MATCH_LIMIT = 500


async def get_vendor(session: AsyncSession, user_id: str) -> VendorRow | None:
    """The user's vendor row, or `None` when they have not started onboarding."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return None
    row = (
        await session.execute(select(*_VENDOR_COLUMNS).where(Vendor.user_id == parsed_id).limit(1))
    ).first()
    return VendorRow.model_validate(plain_row(row)) if row else None


def _is_business_name_clash(error: IntegrityError) -> bool:
    """True when the write broke the unique index on `business_name_normalized`."""
    return _BUSINESS_NAME_INDEX in str(error.orig) or "business_name_normalized" in str(error.orig)


async def save_profile(session: AsyncSession, user_id: str, columns: dict[str, Any], *, exists: bool) -> bool:
    """Insert or update the vendor's row; False when another vendor took the business name meanwhile.

    The write runs in a savepoint so a name clash leaves the request's
    transaction usable for the friendly error that follows.
    """
    parsed_id = as_uuid(user_id)
    try:
        async with session.begin_nested():
            if exists:
                await session.execute(update(Vendor).where(Vendor.user_id == parsed_id).values(**columns))
            else:
                await session.execute(insert(Vendor).values(**columns, user_id=parsed_id))
    except IntegrityError as error:
        if _is_business_name_clash(error):
            return False
        raise
    return True


async def update_vendor(session: AsyncSession, user_id: str, changes: dict[str, Any]) -> None:
    """Apply `changes` (column → value) to the vendor's row."""
    parsed_id = as_uuid(user_id)
    if parsed_id is not None:
        await session.execute(update(Vendor).where(Vendor.user_id == parsed_id).values(**changes))


async def business_name_owner(
    session: AsyncSession, normalized_name: str, *, exclude_user_id: str | None
) -> str | None:
    """The user id of the vendor (other than `exclude_user_id`) already using this normalised name."""
    query = select(Vendor.user_id).where(Vendor.business_name_normalized == normalized_name).limit(1)
    excluded_id = as_uuid(exclude_user_id) if exclude_user_id else None
    if excluded_id is not None:
        query = query.where(Vendor.user_id != excluded_id)
    owner_id = await session.scalar(query)
    return str(owner_id) if owner_id is not None else None


async def vendor_ids_with_business_name_like(session: AsyncSession, pattern: str) -> list[str]:
    """Vendors whose normalised business name matches the ILIKE `pattern`."""
    result = await session.scalars(
        select(Vendor.user_id).where(Vendor.business_name_normalized.ilike(pattern)).limit(SEARCH_MATCH_LIMIT)
    )
    return [str(user_id) for user_id in result]


async def list_vendors(
    session: AsyncSession,
    *,
    offset: int,
    limit: int,
    user_ids: list[str] | None,
    approval_status: str | None,
    status: str | None,
) -> tuple[list[VendorRow], int]:
    """One page of vendors, most recently updated first, and how many match in total."""
    filters: list[ColumnElement[bool]] = []
    if user_ids is not None:
        parsed_ids = [parsed for parsed in (as_uuid(user_id) for user_id in user_ids) if parsed is not None]
        filters.append(Vendor.user_id.in_(parsed_ids))
    if approval_status:
        filters.append(Vendor.approval_status == approval_status)
    if status:
        filters.append(Vendor.status == status)
    total = await session.scalar(select(func.count()).select_from(Vendor).where(*filters))
    result = await session.execute(
        select(*_VENDOR_COLUMNS)
        .where(*filters)
        .order_by(Vendor.updated_at.desc(), Vendor.created_at.desc(), Vendor.id.desc())
        .offset(offset)
        .limit(limit)
    )
    found = [VendorRow.model_validate(plain_row(row)) for row in result]
    return found, int(total or 0)
