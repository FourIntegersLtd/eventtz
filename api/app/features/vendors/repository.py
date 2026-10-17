"""Database access for vendor profiles (the `vendors` table). The only file here that queries tables.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    ColumnElement,
    DateTime,
    Text,
    Uuid,
    and_,
    column,
    func,
    insert,
    or_,
    select,
    table,
    update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.vendors.domain_insurance import (
    EXPIRY_GRACE,
    INSURANCE_REQUIRED_FROM,
    INSURANCE_REQUIRED_SERVICES,
    REMINDER_BEFORE_EXPIRY,
)
from app.features.vendors.models import Vendor
from app.features.vendors.rows import ListedVendorRow, VendorNameRow, VendorRow

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
    Vendor.listing_paused_until,
    Vendor.listing_pause_reason,
    Vendor.insurance_certificate_url,
    Vendor.insurance_expires_on,
    Vendor.insurance_cover_gbp,
    Vendor.insurance_verified_at,
)
# The account table (identity's), read here only to attach the email and skip closed accounts.
_users = table(
    "users",
    column("id", Uuid),
    column("email", Text),
    column("deleted_at", DateTime(timezone=True)),
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


async def vendor_name_rows(session: AsyncSession, user_ids: list[str]) -> list[VendorNameRow]:
    """The payload and closed flag of each of these vendors that has a `vendors` row."""
    parsed_ids = sorted(
        {parsed for parsed in (as_uuid(user_id) for user_id in user_ids) if parsed is not None}
    )
    if not parsed_ids:
        return []
    result = await session.execute(
        select(Vendor.user_id, Vendor.payload, _users.c.deleted_at.is_not(None).label("deleted"))
        .select_from(Vendor)
        .outerjoin(_users, _users.c.id == Vendor.user_id)
        .where(Vendor.user_id.in_(parsed_ids))
    )
    return [
        VendorNameRow(user_id=str(found.user_id), payload=found.payload, deleted=bool(found.deleted))
        for found in result
    ]


def _needs_insurance() -> ColumnElement[bool]:
    """SQL for `domain_insurance.requires_insurance` over the services copied out of the form."""
    return func.coalesce(Vendor.services_offered.overlap(sorted(INSURANCE_REQUIRED_SERVICES)), False)


def _insurance_allows_listing(today: date) -> ColumnElement[bool]:
    """SQL for `domain_insurance.insurance_allows_listing` on `today`."""
    allowed: list[ColumnElement[bool]] = [
        ~_needs_insurance(),
        Vendor.insurance_expires_on >= today - EXPIRY_GRACE,
    ]
    if today < INSURANCE_REQUIRED_FROM:
        allowed.append(Vendor.insurance_expires_on.is_(None))
    return or_(*allowed)


def _publicly_listed(today: date) -> ColumnElement[bool]:
    """SQL for `domain_visibility.is_publicly_listable`: approved, unpaused, not hidden, visible or ready,
    and insured when the vendor's services need it.

    Keep the two in step; the explore freeze tests cover every branch.
    """
    stripe_ready = and_(
        Vendor.stripe_account_id.is_not(None),
        Vendor.stripe_charges_enabled.is_(True),
        Vendor.stripe_payouts_enabled.is_(True),
    )
    return and_(
        Vendor.approval_status == "approved",
        # A staff pause lapses by time: the column is simply compared to now().
        or_(Vendor.listing_paused_until.is_(None), Vendor.listing_paused_until <= func.now()),
        Vendor.listing_override != "hidden",
        or_(Vendor.listing_override == "visible", stripe_ready),
        _insurance_allows_listing(today),
    )


async def marketplace_vendors(
    session: AsyncSession,
    *,
    listed_only: bool,
    country_code: str | None = None,
    user_ids: list[str] | None = None,
    budget_min: float | None = None,
    budget_max: float | None = None,
    service_types: list[str] | None = None,
    city_query: str | None = None,
    today: date | None = None,
) -> list[ListedVendorRow]:
    """Vendors the marketplace may show, most recently updated first, with their account email.

    `listed_only` applies the public listing rule; without it any approved vendor
    matches (for staff-designated QA vendors). Closed accounts never appear. The
    budget, service and city filters read the columns copied out of the profile form.
    `today` (default: the UTC date) decides whether checked insurance is still in date.
    """
    filters: list[ColumnElement[bool]] = [_users.c.deleted_at.is_(None)]
    listing_day = today or datetime.now(UTC).date()
    filters.append(_publicly_listed(listing_day) if listed_only else Vendor.approval_status == "approved")
    if country_code is not None:
        filters.append(Vendor.country_code == country_code)
    if user_ids is not None:
        parsed_ids = [parsed for parsed in (as_uuid(user_id) for user_id in user_ids) if parsed is not None]
        filters.append(Vendor.user_id.in_(parsed_ids))
    if budget_min is not None:
        filters.append(Vendor.min_list_price_gbp >= Decimal(str(budget_min)))
    if budget_max is not None:
        filters.append(Vendor.min_list_price_gbp <= Decimal(str(budget_max)))
    if service_types:
        filters.append(Vendor.services_offered.overlap(service_types))
    if city_query:
        filters.append(Vendor.base_city_normalized.ilike(f"%{city_query}%"))
    result = await session.execute(
        select(
            Vendor.user_id,
            _users.c.email,
            Vendor.status,
            Vendor.approval_status,
            Vendor.payload,
            Vendor.updated_at,
            Vendor.insurance_expires_on,
        )
        .join(_users, _users.c.id == Vendor.user_id)
        .where(*filters)
        .order_by(Vendor.updated_at.desc(), Vendor.created_at.desc(), Vendor.id.desc())
    )
    return [ListedVendorRow.model_validate(plain_row(row)) for row in result]


# --- the payout account (Stripe Connect), for the payments slice ----------------------------


async def vendor_id_for_stripe_account(session: AsyncSession, account_id: str) -> str | None:
    """The vendor whose Stripe Connect account is `account_id`, if any."""
    owner_id = await session.scalar(
        select(Vendor.user_id).where(Vendor.stripe_account_id == account_id).limit(1)
    )
    return str(owner_id) if owner_id is not None else None


async def payouts_nudge_candidates(
    session: AsyncSession, *, approved_before: datetime, limit: int
) -> list[VendorRow]:
    """Approved vendors not yet nudged about payouts whose payouts are still not ready.

    Approved at or before `approved_before`. "Ready" is the listing's own rule: a Connect
    account that can charge and pay out, or an admin's waiver (`listing_override` visible).
    Ready vendors are left out here so they cannot crowd the unready ones out of `limit`.
    """
    result = await session.execute(
        select(*_VENDOR_COLUMNS)
        .where(
            Vendor.approval_status == "approved",
            Vendor.payouts_setup_nudge_at.is_(None),
            Vendor.approved_at.is_not(None),
            Vendor.approved_at <= approved_before,
            Vendor.listing_override != "visible",
            or_(
                Vendor.stripe_account_id.is_(None),
                Vendor.stripe_charges_enabled.is_(False),
                Vendor.stripe_payouts_enabled.is_(False),
            ),
        )
        .order_by(Vendor.approved_at)
        .limit(limit)
    )
    return [VendorRow.model_validate(plain_row(row)) for row in result]


async def claim_payouts_nudge(session: AsyncSession, user_id: str) -> bool:
    """Mark the one payouts-setup nudge as handled; False when another run already claimed it."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return False
    result = await session.execute(
        update(Vendor)
        .where(Vendor.user_id == parsed_id, Vendor.payouts_setup_nudge_at.is_(None))
        .values(payouts_setup_nudge_at=func.now())
        .returning(Vendor.user_id)
    )
    return result.first() is not None


# --- public liability insurance -------------------------------------------------------------


async def insurance_reminder_candidates(session: AsyncSession, *, today: date, limit: int) -> list[VendorRow]:
    """Approved vendors who need insurance, not yet emailed this cycle, with no checked cover or cover
    ending within `REMINDER_BEFORE_EXPIRY` of `today`. Soonest expiry first, unchecked ones last."""
    result = await session.execute(
        select(*_VENDOR_COLUMNS)
        .where(
            Vendor.approval_status == "approved",
            _needs_insurance(),
            Vendor.insurance_reminder_at.is_(None),
            or_(
                Vendor.insurance_expires_on.is_(None),
                Vendor.insurance_expires_on <= today + REMINDER_BEFORE_EXPIRY,
            ),
        )
        .order_by(Vendor.insurance_expires_on.asc().nulls_last(), Vendor.created_at)
        .limit(limit)
    )
    return [VendorRow.model_validate(plain_row(row)) for row in result]


async def claim_insurance_reminder(session: AsyncSession, user_id: str) -> bool:
    """Mark this cycle's insurance email as handled; False when another run already claimed it."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return False
    result = await session.execute(
        update(Vendor)
        .where(Vendor.user_id == parsed_id, Vendor.insurance_reminder_at.is_(None))
        .values(insurance_reminder_at=func.now())
        .returning(Vendor.user_id)
    )
    return result.first() is not None
