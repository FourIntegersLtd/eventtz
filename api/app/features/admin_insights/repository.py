"""Database access for the admin console's dashboards, analytics, directory and vendor insights.

This slice owns no table of its own: every read here crosses into `users`,
`vendors`, `booking_requests`, `booking_reviews`, `dispute_cases`, `conversations`
and `marketplace_events`. Each is a plain `sqlalchemy.table()`/`column()` handle
(the pattern `bookings/repository_admin.py` uses for `dispute_cases` and `vendors`)
rather than an ORM import, because only a table's own slice may import its
`models.py` (`tests/guards/test_sql_lives_in_repositories.py`).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Integer,
    Numeric,
    Text,
    Uuid,
    column,
    func,
    select,
    table,
)
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.core.pagination import LIKE_ESCAPE, contains_pattern
from app.core.time import london_midnight_utc

#: `users.user_type` is a real Postgres enum, not text; a bound Text parameter
#: cannot compare against it without an explicit cast (`operator does not exist:
#: user_type = character varying`), so this handle uses the same enum type that
#: `identity/models.py` declares, with `create_type=False` since it already exists.
_USER_TYPE = ENUM("client", "vendor", "admin", name="user_type", create_type=False)

_users = table(
    "users",
    column("id", Uuid),
    column("email", Text),
    column("user_type", _USER_TYPE),
    column("created_at", DateTime(timezone=True)),
)

_vendors = table(
    "vendors",
    column("user_id", Uuid),
    column("approval_status", Text),
    column("payload", JSON),
    column("services_offered", JSON),
    column("base_city_normalized", Text),
    column("business_name_normalized", Text),
)

_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("vendor_user_id", Uuid),
    column("status", Text),
    column("payment_status", Text),
    column("initiator", Text),
    column("created_at", DateTime(timezone=True)),
    column("updated_at", DateTime(timezone=True)),
    column("paid_at", DateTime(timezone=True)),
    column("accepted_at", DateTime(timezone=True)),
    column("completed_at", DateTime(timezone=True)),
    column("event_date", Date),
    column("event_end_date", Date),
    column("event_postcode", Text),
    column("payment_amount_gbp", Numeric(12, 2)),
    column("failure_reason", Text),
    column("vendor_response_time_seconds", Integer),
    column("client_completion_confirmed_at", DateTime(timezone=True)),
    column("vendor_completion_confirmed_at", DateTime(timezone=True)),
    column("stripe_checkout_session_id", Text),
    column("support_hold", Boolean),
    column("line_items", JSON),
    column("vendor_adjustments", JSON),
    column("service_fee_percent", Numeric(5, 2)),
    column("vendor_referral_code", Text),
)

_booking_reviews = table(
    "booking_reviews",
    column("vendor_user_id", Uuid),
    column("rating", Integer),
    column("hidden_at", DateTime(timezone=True)),
)

_dispute_cases = table(
    "dispute_cases",
    column("booking_request_id", Uuid),
    column("status", Text),
)

_conversations = table("conversations", column("id", Uuid))

_marketplace_events = table(
    "marketplace_events",
    column("event_name", Text),
    column("created_at", DateTime(timezone=True)),
)

#: Dispute statuses that count as "open" for support-attention and vendor-insights counts.
_ACTIVE_DISPUTE_STATUSES = ("open", "under_review")


def _day_bounds(day: str) -> tuple[datetime, datetime]:
    """The `[start, end)` instant range of one London `YYYY-MM-DD` day (23 to 25 hours long)."""
    first = date.fromisoformat(day)
    return (
        london_midnight_utc(first),
        london_midnight_utc(first + timedelta(days=1)),
    )


async def _count(session: AsyncSession, handle: Any, *conditions: Any) -> int:
    """`SELECT count(*)` over one table handle, with optional WHERE clauses."""
    result = await session.execute(select(func.count()).select_from(handle).where(*conditions))
    return int(result.scalar_one())


async def count_users_by_type(session: AsyncSession, user_type: str) -> int:
    """How many accounts have this `user_type` (client, vendor or admin)."""
    return await _count(session, _users, _users.c.user_type == user_type)


async def count_vendors_by_approval(session: AsyncSession, approval_status: str) -> int:
    """How many vendor profiles carry this `approval_status`."""
    return await _count(session, _vendors, _vendors.c.approval_status == approval_status)


async def count_bookings_by_status(session: AsyncSession, status: str) -> int:
    """How many bookings currently have this `status`."""
    return await _count(session, _booking_requests, _booking_requests.c.status == status)


async def count_paid_bookings(session: AsyncSession) -> int:
    """How many bookings have ever been paid (`paid_at` set), regardless of current status."""
    return await _count(session, _booking_requests, _booking_requests.c.paid_at.is_not(None))


async def count_conversations(session: AsyncSession) -> int:
    """How many conversation threads exist."""
    return await _count(session, _conversations)


async def count_reviews(session: AsyncSession) -> int:
    """How many booking reviews exist (hidden ones included, matching the baseline count)."""
    return await _count(session, _booking_reviews)


async def count_open_disputes(session: AsyncSession) -> int:
    """How many disputes are currently open or under review."""
    return await _count(session, _dispute_cases, _dispute_cases.c.status.in_(_ACTIVE_DISPUTE_STATUSES))


async def bookings_for_support_scan(session: AsyncSession, *, scan_limit: int) -> list[dict[str, Any]]:
    """The `scan_limit` most recently *updated* bookings, for the needs-attention count.

    Matches the baseline's `count_bookings_needing_support_attention`, which orders
    by `updated_at desc` so a booking that just changed state is scanned first.
    """
    result = await session.execute(
        select(
            _booking_requests.c.id,
            _booking_requests.c.vendor_user_id,
            _booking_requests.c.status,
            _booking_requests.c.payment_status,
            _booking_requests.c.event_date,
            _booking_requests.c.event_end_date,
            _booking_requests.c.client_completion_confirmed_at,
            _booking_requests.c.vendor_completion_confirmed_at,
            _booking_requests.c.stripe_checkout_session_id,
            _booking_requests.c.support_hold,
            _booking_requests.c.paid_at,
        )
        .order_by(_booking_requests.c.updated_at.desc())
        .limit(scan_limit)
    )
    return [plain_row(row) for row in result]


async def vendor_payouts_enabled_by_user_id(
    session: AsyncSession, vendor_user_ids: list[str]
) -> dict[str, bool]:
    """Whether each vendor has Stripe payouts switched on (a connected, enabled account)."""
    vendor_uuids = [parsed for parsed in (as_uuid(vendor_id) for vendor_id in vendor_user_ids) if parsed]
    if not vendor_uuids:
        return {}
    handle = table(
        "vendors",
        column("user_id", Uuid),
        column("stripe_account_id", Text),
        column("stripe_payouts_enabled", Boolean),
    )
    result = await session.execute(
        select(handle.c.user_id, handle.c.stripe_account_id, handle.c.stripe_payouts_enabled).where(
            handle.c.user_id.in_(vendor_uuids)
        )
    )
    return {str(vendor_id): bool(account_id and enabled) for vendor_id, account_id, enabled in result}


async def booking_ids_with_active_disputes(session: AsyncSession, booking_ids: list[str]) -> set[str]:
    """Which of these bookings have a dispute that is open or under review."""
    booking_uuids = [parsed for parsed in (as_uuid(booking_id) for booking_id in booking_ids) if parsed]
    if not booking_uuids:
        return set()
    result = await session.execute(
        select(_dispute_cases.c.booking_request_id).where(
            _dispute_cases.c.booking_request_id.in_(booking_uuids),
            _dispute_cases.c.status.in_(_ACTIVE_DISPUTE_STATUSES),
        )
    )
    return {str(booking_id) for booking_id in result.scalars()}


async def count_open_disputes_for_bookings(session: AsyncSession, booking_ids: list[str]) -> int:
    """How many of these bookings have a dispute that is open or under review."""
    return len(await booking_ids_with_active_disputes(session, booking_ids))


async def bookings_created_in_range(session: AsyncSession, days: list[str]) -> list[dict[str, Any]]:
    """Every booking created within the given days (their `created_at` only)."""
    start = _day_bounds(days[0])[0]
    end = _day_bounds(days[-1])[1]
    result = await session.execute(
        select(_booking_requests.c.created_at).where(
            _booking_requests.c.created_at >= start, _booking_requests.c.created_at < end
        )
    )
    return [plain_row(row) for row in result]


async def bookings_paid_in_range(session: AsyncSession, days: list[str]) -> list[dict[str, Any]]:
    """Every booking paid within the given days: `paid_at`, takings, and enough pricing
    columns (`line_items`, `vendor_adjustments`, `service_fee_percent`, `vendor_referral_code`)
    to price a booking whose `payment_amount_gbp` snapshot is missing.
    """
    start = _day_bounds(days[0])[0]
    end = _day_bounds(days[-1])[1]
    result = await session.execute(
        select(
            _booking_requests.c.id,
            _booking_requests.c.vendor_user_id,
            _booking_requests.c.paid_at,
            _booking_requests.c.payment_amount_gbp,
            _booking_requests.c.line_items,
            _booking_requests.c.vendor_adjustments,
            _booking_requests.c.service_fee_percent,
            _booking_requests.c.vendor_referral_code,
        ).where(_booking_requests.c.paid_at >= start, _booking_requests.c.paid_at < end)
    )
    return [plain_row(row) for row in result]


async def signups_in_range(session: AsyncSession, days: list[str]) -> list[dict[str, Any]]:
    """Every account created within the given days (their `created_at` and `user_type`)."""
    start = _day_bounds(days[0])[0]
    end = _day_bounds(days[-1])[1]
    result = await session.execute(
        select(_users.c.created_at, _users.c.user_type).where(
            _users.c.created_at >= start,
            _users.c.created_at < end,
            _users.c.user_type.in_(("client", "vendor")),
        )
    )
    return [plain_row(row) for row in result]


async def enquiries_in_range(session: AsyncSession, *, from_date: str, to_date: str) -> list[dict[str, Any]]:
    """Every client-initiated booking created in `[from_date, to_date]` (the marketplace funnel's rows)."""
    start = _day_bounds(from_date)[0]
    end = _day_bounds(to_date)[1]
    result = await session.execute(
        select(
            _booking_requests.c.vendor_user_id,
            _booking_requests.c.status,
            _booking_requests.c.payment_status,
            _booking_requests.c.created_at,
            _booking_requests.c.updated_at,
            _booking_requests.c.accepted_at,
            _booking_requests.c.completed_at,
            _booking_requests.c.event_postcode,
            _booking_requests.c.payment_amount_gbp,
            _booking_requests.c.failure_reason,
            _booking_requests.c.vendor_response_time_seconds,
        ).where(
            _booking_requests.c.initiator == "client",
            _booking_requests.c.created_at >= start,
            _booking_requests.c.created_at < end,
        )
    )
    return [plain_row(row) for row in result]


async def vendors_by_id(session: AsyncSession, vendor_user_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Every listed vendor's category/location metadata, batched by id."""
    parsed_ids = (as_uuid(vendor_id) for vendor_id in vendor_user_ids)
    vendor_uuids = list({parsed for parsed in parsed_ids if parsed})
    if not vendor_uuids:
        return {}
    out: dict[str, dict[str, Any]] = {}
    chunk_size = 100
    for offset in range(0, len(vendor_uuids), chunk_size):
        chunk = vendor_uuids[offset : offset + chunk_size]
        result = await session.execute(
            select(
                _vendors.c.user_id,
                _vendors.c.payload,
                _vendors.c.services_offered,
                _vendors.c.base_city_normalized,
            ).where(_vendors.c.user_id.in_(chunk))
        )
        for row in result:
            plain = plain_row(row)
            out[str(plain["user_id"])] = plain
    return out


async def count_vendors_total_and_active(session: AsyncSession) -> tuple[int, int]:
    """Every vendor profile, and how many are approved or submitted (publicly visible or nearly so)."""
    total_result = await session.execute(select(func.count()).select_from(_vendors))
    total = int(total_result.scalar_one())
    active_result = await session.execute(
        select(func.count())
        .select_from(_vendors)
        .where(_vendors.c.approval_status.in_(("approved", "submitted")))
    )
    active = int(active_result.scalar_one())
    return total, active


async def review_stats(
    session: AsyncSession, vendor_user_ids: list[str] | None = None
) -> tuple[float | None, int]:
    """The average rating and count of non-hidden reviews, overall or for the given vendors."""
    conditions: list[Any] = [_booking_reviews.c.hidden_at.is_(None)]
    if vendor_user_ids is not None:
        vendor_uuids = [parsed for parsed in (as_uuid(vendor_id) for vendor_id in vendor_user_ids) if parsed]
        if not vendor_uuids:
            return None, 0
        conditions.append(_booking_reviews.c.vendor_user_id.in_(vendor_uuids))
    result = await session.execute(
        select(func.avg(_booking_reviews.c.rating), func.count())
        .select_from(_booking_reviews)
        .where(*conditions)
    )
    average, count = result.one()
    return (round(float(average), 2) if average is not None else None), int(count or 0)


async def marketplace_event_count(
    session: AsyncSession, event_name: str, *, from_date: str, to_date: str
) -> int:
    """How many `marketplace_events` rows of this type fall within the date range."""
    start = _day_bounds(from_date)[0]
    end = _day_bounds(to_date)[1]
    return await _count(
        session,
        _marketplace_events,
        _marketplace_events.c.event_name == event_name,
        _marketplace_events.c.created_at >= start,
        _marketplace_events.c.created_at < end,
    )


async def search_directory_client_users(
    session: AsyncSession, *, term: str, limit: int
) -> list[dict[str, Any]]:
    """Clients whose email contains `term` (case-insensitive)."""
    result = await session.execute(
        select(_users.c.id, _users.c.email)
        .where(
            _users.c.user_type == "client",
            _users.c.email.ilike(contains_pattern(term), escape=LIKE_ESCAPE),
        )
        .limit(limit)
    )
    return [plain_row(row) for row in result]


async def search_directory_vendor_users_by_email(
    session: AsyncSession, *, term: str, limit: int
) -> list[dict[str, Any]]:
    """Vendor accounts whose email contains `term` (case-insensitive)."""
    result = await session.execute(
        select(_users.c.id, _users.c.email)
        .where(
            _users.c.user_type == "vendor",
            _users.c.email.ilike(contains_pattern(term), escape=LIKE_ESCAPE),
        )
        .limit(limit)
    )
    return [plain_row(row) for row in result]


async def search_directory_vendor_users_by_business_name(
    session: AsyncSession, *, term: str, limit: int
) -> list[dict[str, Any]]:
    """Vendor accounts whose normalised business name contains `term`, with their email."""
    result = await session.execute(
        select(_users.c.id, _users.c.email, _vendors.c.business_name_normalized)
        .select_from(_vendors.join(_users, _users.c.id == _vendors.c.user_id))
        .where(_vendors.c.business_name_normalized.ilike(contains_pattern(term), escape=LIKE_ESCAPE))
        .limit(limit)
    )
    return [plain_row(row) for row in result]


async def vendor_bookings(session: AsyncSession, vendor_user_id: str) -> list[dict[str, Any]]:
    """Every booking naming this vendor, for the status/month breakdown. Empty for an unknown id."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return []
    result = await session.execute(
        select(_booking_requests.c.id, _booking_requests.c.status, _booking_requests.c.created_at).where(
            _booking_requests.c.vendor_user_id == vendor_uuid
        )
    )
    return [plain_row(row) for row in result]
