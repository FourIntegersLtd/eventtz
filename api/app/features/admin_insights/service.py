"""Use cases for the admin console's dashboards, analytics, directory and vendor insights.

Every function here is a thin orchestration: ask `repository.py` for rows, hand
them to `domain.py`'s pure maths, and wrap the result in a `schemas.py` model.
None of them touch a `Principal`'s identity - the route only cares that *some*
staff account is signed in (`CurrentStaff`), and no route here is super-admin-only.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.admin_insights import domain, repository
from app.features.admin_insights.errors import InvalidDateFilter
from app.features.admin_insights.schemas import (
    AdminDashboardMetrics,
    AdminDashboardSummary,
    AdminDirectorySearchResponse,
    AdminDirectoryUserRow,
    AdminMarketplaceAnalyticsResponse,
    AdminVendorInsightsResponse,
)

#: `marketplace_events.event_name` values the analytics overview counts.
_PROFILE_VIEW_EVENT = "vendor_profile_viewed"
_VENDOR_REMINDER_EVENT = "enquiry_vendor_reminded"
_CLIENT_NUDGE_EVENT = "enquiry_client_no_response_nudge"
_MULTI_BATCH_EVENT = "enquiry_multi_created"


def _parse_date(value: str | None) -> date | None:
    """`value` as a calendar date, or raise `InvalidDateFilter` for anything malformed."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise InvalidDateFilter() from error


async def dashboard_summary(session: AsyncSession) -> AdminDashboardSummary:
    """Headline counts across users, vendors, bookings, conversations and reviews."""
    scan_rows = await repository.bookings_for_support_scan(
        session, scan_limit=domain.SUPPORT_ATTENTION_SCAN_LIMIT
    )
    vendor_ids = list({str(row["vendor_user_id"]) for row in scan_rows if row.get("vendor_user_id")})
    booking_ids = [str(row["id"]) for row in scan_rows]
    payouts_enabled = await repository.vendor_payouts_enabled_by_user_id(session, vendor_ids)
    disputed_ids = await repository.booking_ids_with_active_disputes(session, booking_ids)
    needing_support = domain.count_bookings_needing_support(
        scan_rows, payouts_enabled_by_vendor=payouts_enabled, disputed_booking_ids=disputed_ids
    )

    return AdminDashboardSummary(
        users_client=await repository.count_users_by_type(session, "client"),
        users_vendor=await repository.count_users_by_type(session, "vendor"),
        users_admin=await repository.count_users_by_type(session, "admin"),
        vendors_pending=await repository.count_vendors_by_approval(session, "pending"),
        vendors_approved=await repository.count_vendors_by_approval(session, "approved"),
        vendors_banned=await repository.count_vendors_by_approval(session, "banned"),
        bookings_pending=await repository.count_bookings_by_status(session, "pending"),
        bookings_accepted=await repository.count_bookings_by_status(session, "accepted"),
        bookings_completed=await repository.count_bookings_by_status(session, "completed"),
        bookings_declined=await repository.count_bookings_by_status(session, "declined"),
        bookings_cancelled=await repository.count_bookings_by_status(session, "cancelled"),
        bookings_paid_count=await repository.count_paid_bookings(session),
        bookings_needing_support=needing_support,
        conversations_count=await repository.count_conversations(session),
        reviews_count=await repository.count_reviews(session),
    )


async def dashboard_metrics(session: AsyncSession, *, requested_days: int) -> AdminDashboardMetrics:
    """The rolling-window charts: bookings created, bookings paid, signups, and open disputes."""
    period_days = domain.resolve_metrics_days(requested_days)
    days = domain.date_range(period_days)

    created_rows = await repository.bookings_created_in_range(session, days)
    paid_rows = await repository.bookings_paid_in_range(session, days)
    signup_rows = await repository.signups_in_range(session, days)
    open_disputes = await repository.count_open_disputes(session)

    return AdminDashboardMetrics(
        period_days=period_days,
        bookings_created=domain.build_booking_created_buckets(days, created_rows),
        bookings_paid=domain.build_booking_paid_buckets(days, paid_rows),
        signups=domain.build_signup_buckets(days, signup_rows),
        open_disputes_count=open_disputes,
    )


async def marketplace_analytics(
    session: AsyncSession, *, from_date_raw: str | None, to_date_raw: str | None
) -> AdminMarketplaceAnalyticsResponse:
    """The marketplace funnel over client-initiated enquiries in the given date range.

    Defaults to the trailing 30 days when no range is given, same as the dashboard charts.
    """
    parsed_to = _parse_date(to_date_raw) or date.today()
    parsed_from = _parse_date(from_date_raw) or (parsed_to - timedelta(days=29))
    from_date = parsed_from.isoformat()
    to_date = parsed_to.isoformat()

    enquiries = await repository.enquiries_in_range(session, from_date=from_date, to_date=to_date)
    vendor_ids = [str(row["vendor_user_id"]) for row in enquiries if row.get("vendor_user_id")]
    vendors_by_id = await repository.vendors_by_id(session, vendor_ids)
    vendors_total, vendors_active = await repository.count_vendors_total_and_active(session)
    avg_rating, review_count = await repository.review_stats(session)

    profile_views = await repository.marketplace_event_count(
        session, _PROFILE_VIEW_EVENT, from_date=from_date, to_date=to_date
    )
    vendor_reminders = await repository.marketplace_event_count(
        session, _VENDOR_REMINDER_EVENT, from_date=from_date, to_date=to_date
    )
    client_nudges = await repository.marketplace_event_count(
        session, _CLIENT_NUDGE_EVENT, from_date=from_date, to_date=to_date
    )
    multi_batches = await repository.marketplace_event_count(
        session, _MULTI_BATCH_EVENT, from_date=from_date, to_date=to_date
    )

    built = domain.build_marketplace_analytics(
        from_date=from_date,
        to_date=to_date,
        enquiries=enquiries,
        vendors_by_id=vendors_by_id,
        vendors_total=vendors_total,
        vendors_active=vendors_active,
        avg_rating=avg_rating or 0.0,
        review_count=review_count,
        profile_views=profile_views,
        vendor_reminders=vendor_reminders,
        client_nudges=client_nudges,
        multi_batches=multi_batches,
    )
    return AdminMarketplaceAnalyticsResponse(**built)


def _dedupe_users(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop repeats of the same `user_id`, keeping the first (earliest-matched) occurrence."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        user_id = str(row["user_id"])
        if user_id in seen:
            continue
        seen.add(user_id)
        out.append(row)
    return out


async def directory_search(
    session: AsyncSession, *, query: str, kinds: str, limit: int
) -> AdminDirectorySearchResponse:
    """Accounts matching `query`: a client's email, or a vendor's email or business name."""
    wanted_kinds = {kind.strip() for kind in kinds.split(",") if kind.strip()}
    matches: list[dict[str, Any]] = []

    if "client" in wanted_kinds:
        for row in await repository.search_directory_client_users(session, term=query, limit=limit):
            matches.append(
                {"user_id": row["id"], "label": row["email"], "kind": "client", "email": row["email"]}
            )

    if "vendor" in wanted_kinds:
        by_email = await repository.search_directory_vendor_users_by_email(session, term=query, limit=limit)
        for row in by_email:
            matches.append(
                {"user_id": row["id"], "label": row["email"], "kind": "vendor", "email": row["email"]}
            )
        if len(by_email) < limit:
            by_name = await repository.search_directory_vendor_users_by_business_name(
                session, term=query, limit=limit
            )
            for row in by_name:
                label = row.get("business_name_normalized") or row["email"] or str(row["id"])
                matches.append(
                    {"user_id": row["id"], "label": label, "kind": "vendor", "email": row["email"]}
                )

    deduped = _dedupe_users(matches)[:limit]
    return AdminDirectorySearchResponse(
        users=[AdminDirectoryUserRow(**{**row, "user_id": str(row["user_id"])}) for row in deduped]
    )


async def vendor_insights(session: AsyncSession, user_id: str) -> AdminVendorInsightsResponse:
    """One vendor's booking history and review standing. Never 404s: an unknown id reads as all-zero."""
    booking_rows = await repository.vendor_bookings(session, user_id)
    booking_ids = [str(row["id"]) for row in booking_rows]
    review_average, review_count = await repository.review_stats(session, [user_id])
    open_disputes = await repository.count_open_disputes_for_bookings(session, booking_ids)

    built = domain.build_vendor_insights(
        user_id=user_id,
        review_average=review_average,
        review_count=review_count,
        booking_rows=booking_rows,
        open_disputes=open_disputes,
    )
    return AdminVendorInsightsResponse(**built)
