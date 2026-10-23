"""Database access for referral partners, attributions and vendor client codes. The only querying file.

Two tables belong to this slice (`referral_partners`, `referral_attributions`). It also
reads the referral columns of `vendors` and `booking_requests` directly for now, through
the lightweight table handles below rather than the owning slices' models; those reads
move behind `vendors.service` and `bookings.service` when those slices are rebuilt.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Numeric, Text, Uuid, column, func, select, table, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement

from app.core.db import as_uuid, plain_row
from app.core.pagination import paged
from app.features.referrals.domain import ShoutoutFilter
from app.features.referrals.models import ReferralAttribution, ReferralPartner
from app.features.referrals.rows import (
    AttributionRow,
    PartnerRow,
    ReferralBookingRow,
    SignupVendorRow,
    VendorCodeRow,
)

# Other slices' tables, declared with only the columns read here (typed, so ids bind as uuid).
_vendors = table(
    "vendors",
    column("user_id", Uuid),
    column("status", Text),
    column("approval_status", Text),
    column("payload", JSONB),
    column("client_referral_code", Text),
    column("client_referral_enabled", Boolean),
)
_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("status", Text),
    column("payment_status", Text),
    column("event_name", Text),
    column("event_date", Date),
    column("created_at", DateTime(timezone=True)),
    column("updated_at", DateTime(timezone=True)),
    column("client_user_id", Uuid),
    column("vendor_user_id", Uuid),
    column("line_items", JSONB),
    column("vendor_adjustments", JSONB),
    column("vendor_referral_code", Text),
    column("service_fee_percent", Numeric),
    column("referral_fee_discount_gbp", Numeric),
)


def _uuids(ids: list[str]) -> list[uuid.UUID]:
    """The ids that are valid UUIDs, parsed (the rest cannot name a row)."""
    return [parsed for parsed in (as_uuid(raw_id) for raw_id in ids) if parsed is not None]


# --- creator partners --------------------------------------------------------------------------

_PARTNER_COLUMNS = (
    ReferralPartner.id,
    ReferralPartner.slug,
    ReferralPartner.display_name,
    ReferralPartner.instagram_handle,
    ReferralPartner.notes,
    ReferralPartner.is_active,
    ReferralPartner.created_at,
    ReferralPartner.updated_at,
)


async def list_partners_newest_first(session: AsyncSession) -> list[PartnerRow]:
    """Every partner, most recently created first."""
    rows, _total = await list_partners_newest_first_page(session, offset=0, limit=500)
    return rows


async def list_partners_newest_first_page(
    session: AsyncSession, *, offset: int, limit: int
) -> tuple[list[PartnerRow], int]:
    """One page of partners plus total count."""
    found_rows, total = await paged(
        session,
        select(*_PARTNER_COLUMNS),
        order_by=[ReferralPartner.created_at.desc()],
        tie_breaker=ReferralPartner.id.desc(),
        offset=offset,
        limit=limit,
        count_query=select(func.count()).select_from(ReferralPartner),
    )
    return [PartnerRow.model_validate(plain_row(row)) for row in found_rows], total


async def count_active_partners(session: AsyncSession) -> int:
    """How many partners are switched on, across all of them (not one page)."""
    return int(
        (
            await session.execute(
                select(func.count()).select_from(ReferralPartner).where(ReferralPartner.is_active.is_(True))
            )
        ).scalar_one()
    )


async def find_partner(session: AsyncSession, partner_id: str) -> PartnerRow | None:
    """One partner by id; `None` for an unknown or malformed id."""
    parsed_id = as_uuid(partner_id)
    if parsed_id is None:
        return None
    row = (await session.execute(select(*_PARTNER_COLUMNS).where(ReferralPartner.id == parsed_id))).first()
    return PartnerRow.model_validate(plain_row(row)) if row else None


async def find_partner_by_slug(session: AsyncSession, slug: str, *, active_only: bool) -> PartnerRow | None:
    """One partner by exact slug, optionally only if switched on."""
    query = select(*_PARTNER_COLUMNS).where(ReferralPartner.slug == slug)
    if active_only:
        query = query.where(ReferralPartner.is_active.is_(True))
    row = (await session.execute(query.limit(1))).first()
    return PartnerRow.model_validate(plain_row(row)) if row else None


async def slugs_starting_with(session: AsyncSession, prefix: str) -> set[str]:
    """Every slug that begins with `prefix`, to pick the first free `prefix-N` in one query.

    Valid slugs contain only letters, digits and dashes, so `prefix` has no LIKE wildcards.
    """
    result = await session.execute(
        select(ReferralPartner.slug).where(ReferralPartner.slug.like(f"{prefix}%"))
    )
    return {slug for slug in result.scalars() if slug}


async def insert_partner(session: AsyncSession, values: dict[str, Any]) -> PartnerRow | None:
    """Store a new partner and return it; `None` when the slug was taken meanwhile (unique index)."""
    creator_id = values.get("created_by_admin_id")
    partner = ReferralPartner(**{**values, "created_by_admin_id": as_uuid(creator_id)})
    try:
        async with session.begin_nested():
            session.add(partner)
    except IntegrityError:
        return None
    return await find_partner(session, str(partner.id))


async def update_partner(
    session: AsyncSession, partner_id: str, changes: dict[str, Any]
) -> PartnerRow | None:
    """Apply `changes` to a partner and return it, or `None` when no partner has that id."""
    parsed_id = as_uuid(partner_id)
    if parsed_id is None:
        return None
    result = await session.execute(
        update(ReferralPartner)
        .where(ReferralPartner.id == parsed_id)
        .values(**changes)
        .returning(*_PARTNER_COLUMNS)
    )
    row = result.first()
    return PartnerRow.model_validate(plain_row(row)) if row else None


# --- attributions (vendors who signed up through a partner) ------------------------------------

_ATTRIBUTION_COLUMNS = (
    ReferralAttribution.user_id,
    ReferralAttribution.referral_partner_id,
    ReferralAttribution.referral_slug,
    ReferralAttribution.attributed_at,
    ReferralAttribution.shoutout_completed,
    ReferralAttribution.shoutout_completed_at,
)


def _attribution_filters(partner_id: uuid.UUID, shoutout: ShoutoutFilter) -> list[Any]:
    """The WHERE clauses for a partner's attributions in one shout-out state."""
    filters: list[Any] = [ReferralAttribution.referral_partner_id == partner_id]
    if shoutout == "pending":
        filters.append(ReferralAttribution.shoutout_completed.is_(False))
    elif shoutout == "completed":
        filters.append(ReferralAttribution.shoutout_completed.is_(True))
    return filters


async def list_attributions_page(
    session: AsyncSession, partner_id: str, *, shoutout: ShoutoutFilter, offset: int, limit: int
) -> tuple[list[AttributionRow], int]:
    """One page of a partner's attributions, newest first, and how many match in total.

    An offset past the end is an empty page with the true total (the baseline answered 500).
    """
    parsed_id = as_uuid(partner_id)
    if parsed_id is None:
        return [], 0
    filters = _attribution_filters(parsed_id, shoutout)
    found_rows, total = await paged(
        session,
        select(*_ATTRIBUTION_COLUMNS).where(*filters),
        order_by=[ReferralAttribution.attributed_at.desc()],
        tie_breaker=ReferralAttribution.user_id.desc(),
        offset=offset,
        limit=limit,
        count_query=select(func.count()).select_from(ReferralAttribution).where(*filters),
    )
    return [AttributionRow.model_validate(plain_row(row)) for row in found_rows], total


async def find_attribution(session: AsyncSession, user_id: str) -> AttributionRow | None:
    """The attribution for one vendor (each vendor has at most one: `user_id` is the key)."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return None
    row = (
        await session.execute(select(*_ATTRIBUTION_COLUMNS).where(ReferralAttribution.user_id == parsed_id))
    ).first()
    return AttributionRow.model_validate(plain_row(row)) if row else None


async def set_shoutout(
    session: AsyncSession, user_id: str, *, completed: bool, completed_at: str | None
) -> bool:
    """Record whether the partner has been thanked for this vendor. False when no attribution exists."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return False
    result = await session.execute(
        update(ReferralAttribution)
        .where(ReferralAttribution.user_id == parsed_id)
        .values(shoutout_completed=completed, shoutout_completed_at=completed_at)
        .returning(ReferralAttribution.user_id)
    )
    return result.first() is not None


async def insert_attribution(session: AsyncSession, values: dict[str, Any]) -> bool:
    """Attribute a vendor to a partner. False if the vendor already has one (first touch wins)."""
    attribution = ReferralAttribution(
        **{
            **values,
            "user_id": as_uuid(values["user_id"]),
            "referral_partner_id": as_uuid(values["referral_partner_id"]),
        }
    )
    try:
        async with session.begin_nested():
            session.add(attribution)
    except IntegrityError:
        return False
    return True


async def list_signup_vendors(session: AsyncSession, user_ids: list[str]) -> list[SignupVendorRow]:
    """The vendor profiles of the given users (users without one are absent)."""
    parsed_ids = _uuids(user_ids)
    if not parsed_ids:
        return []
    result = await session.execute(
        select(_vendors.c.user_id, _vendors.c.status, _vendors.c.approval_status, _vendors.c.payload).where(
            _vendors.c.user_id.in_(parsed_ids)
        )
    )
    return [SignupVendorRow.model_validate(plain_row(row)) for row in result]


# --- vendor client codes -----------------------------------------------------------------------

_VENDOR_CODE_COLUMNS = (
    _vendors.c.user_id,
    _vendors.c.approval_status,
    _vendors.c.client_referral_code,
    _vendors.c.client_referral_enabled,
)


async def find_vendor_code_settings(session: AsyncSession, vendor_user_id: str) -> VendorCodeRow | None:
    """A vendor's referral settings, or `None` when they have no vendor profile."""
    parsed_id = as_uuid(vendor_user_id)
    if parsed_id is None:
        return None
    row = (
        await session.execute(select(*_VENDOR_CODE_COLUMNS).where(_vendors.c.user_id == parsed_id).limit(1))
    ).first()
    return VendorCodeRow.model_validate(plain_row(row)) if row else None


async def find_vendor_by_code(session: AsyncSession, code: str) -> VendorCodeRow | None:
    """The vendor that owns a (normalised) client code today, if any."""
    row = (
        await session.execute(
            select(*_VENDOR_CODE_COLUMNS).where(_vendors.c.client_referral_code == code).limit(1)
        )
    ).first()
    return VendorCodeRow.model_validate(plain_row(row)) if row else None


async def code_owners(session: AsyncSession, codes: set[str]) -> dict[str, str]:
    """Map each (normalised) code to the vendor that owns it today; unowned codes are absent."""
    if not codes:
        return {}
    result = await session.execute(
        select(_vendors.c.user_id, _vendors.c.client_referral_code).where(
            _vendors.c.client_referral_code.in_(sorted(codes))
        )
    )
    return {str(code): str(owner_id or "") for owner_id, code in result if code}


async def code_taken_by_another_vendor(session: AsyncSession, code: str, vendor_user_id: str) -> bool:
    """True when a vendor other than `vendor_user_id` owns `code`."""
    query = select(_vendors.c.user_id).where(_vendors.c.client_referral_code == code)
    parsed_id = as_uuid(vendor_user_id)
    if parsed_id is not None:
        query = query.where(_vendors.c.user_id != parsed_id)
    return (await session.execute(query.limit(1))).first() is not None


async def save_vendor_code(session: AsyncSession, vendor_user_id: str, code: str) -> bool:
    """Give a vendor their code. False when another vendor claimed it first (the column is unique)."""
    parsed_id = as_uuid(vendor_user_id)
    if parsed_id is None:
        return False
    try:
        async with session.begin_nested():
            await session.execute(
                update(_vendors).where(_vendors.c.user_id == parsed_id).values(client_referral_code=code)
            )
    except IntegrityError:
        return False
    return True


# The vendor referral screen lists at most this many bookings.
REFERRAL_BOOKINGS_LIMIT = 200


# Statuses the vendor's referrals screen counts as "Accepted" (the booking was taken up).
ACCEPTED_REFERRAL_STATUSES = ("accepted", "completed")


def _referral_bookings_where(vendor_uuid: object) -> tuple[ColumnElement[bool], ColumnElement[bool]]:
    """Bookings that used a vendor referral code."""
    bookings = _booking_requests.c
    return (
        bookings.vendor_user_id == vendor_uuid,
        bookings.vendor_referral_code.is_not(None),
    )


def _referral_bookings_select() -> Select[Any]:
    """Columns needed for vendor referral booking rows."""
    bookings = _booking_requests.c
    return select(
        bookings.id,
        bookings.status,
        bookings.payment_status,
        bookings.event_name,
        bookings.event_date,
        bookings.created_at,
        bookings.client_user_id,
        bookings.vendor_user_id,
        bookings.line_items,
        bookings.vendor_adjustments,
        bookings.vendor_referral_code,
        bookings.service_fee_percent,
        bookings.referral_fee_discount_gbp,
    )


async def list_referral_bookings(session: AsyncSession, vendor_user_id: str) -> list[ReferralBookingRow]:
    """The vendor's bookings made with any referral code (retired ones too), most recent first."""
    rows, _total = await list_referral_bookings_page(
        session, vendor_user_id, offset=0, limit=REFERRAL_BOOKINGS_LIMIT
    )
    return rows


async def count_accepted_referral_bookings(session: AsyncSession, vendor_user_id: str) -> int:
    """How many of the vendor's referral bookings are accepted or completed, across all pages."""
    parsed_id = as_uuid(vendor_user_id)
    if parsed_id is None:
        return 0
    query = (
        select(func.count())
        .select_from(_booking_requests)
        .where(
            *_referral_bookings_where(parsed_id), _booking_requests.c.status.in_(ACCEPTED_REFERRAL_STATUSES)
        )
    )
    return int((await session.execute(query)).scalar_one())


async def list_referral_bookings_page(
    session: AsyncSession, vendor_user_id: str, *, offset: int, limit: int
) -> tuple[list[ReferralBookingRow], int]:
    """One page of referral bookings plus total count."""
    parsed_id = as_uuid(vendor_user_id)
    if parsed_id is None:
        return [], 0
    party_filter = _referral_bookings_where(parsed_id)
    found_rows, total = await paged(
        session,
        _referral_bookings_select().where(*party_filter),
        order_by=[_booking_requests.c.updated_at.desc(), _booking_requests.c.created_at.desc()],
        tie_breaker=_booking_requests.c.id.desc(),
        offset=offset,
        limit=limit,
        count_query=select(func.count()).select_from(_booking_requests).where(*party_filter),
    )
    return [ReferralBookingRow.model_validate(plain_row(row)) for row in found_rows], total
