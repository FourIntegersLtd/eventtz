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

#: `marketplace_events.event_name` values the analytics overview counts.
from app.core.pagination import DEFAULT_LIST_LIMIT
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
from app.features.pricing import service as pricing
from app.features.referrals import service_client_codes as referral_codes

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


async def _with_gmv_fallback(session: AsyncSession, paid_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Each paid-booking row, plus the `gmv_gbp` the takings chart should count for it.

    Mirrors the baseline's `build_pricing_breakdown_for_booking_row` fallback
    (`backend/app/features/admin/dashboard_metrics.py`): a row with a stored
    `payment_amount_gbp` snapshot uses it as-is; a row without one (paid before
    that column existed, or never snapshotted) is priced from its own line items,
    vendor adjustments and referral code instead of being silently dropped.
    """
    rows_needing_pricing = [row for row in paid_rows if row.get("payment_amount_gbp") is None]
    codes = {
        str(row["vendor_referral_code"]) for row in rows_needing_pricing if row.get("vendor_referral_code")
    }
    owners = await referral_codes.code_owners(session, codes) if codes else {}

    priced_rows: list[dict[str, Any]] = []
    for row in paid_rows:
        amount = row.get("payment_amount_gbp")
        try:
            gmv_gbp = float(amount) if amount is not None else None
        except (TypeError, ValueError):
            gmv_gbp = None
        if gmv_gbp is None:
            vendor_portion = pricing.vendor_portion_gbp(row.get("line_items"), row.get("vendor_adjustments"))
            discount, tier_min = referral_codes.booking_code_discount(
                stored_code=row.get("vendor_referral_code"),
                booking_vendor_id=str(row.get("vendor_user_id") or "") or None,
                owners=owners,
                vendor_portion_gbp=vendor_portion,
            )
            breakdown = pricing.build_pricing_breakdown(
                line_items=row.get("line_items"),
                vendor_adjustments=row.get("vendor_adjustments"),
                service_fee_percent=pricing.resolve_service_fee_percent(row),
                referral_fee_discount_gbp=discount,
                referral_tier_min_spend_gbp=tier_min,
            )
            gmv_gbp = breakdown.client_total_gbp
        priced_rows.append({**row, "gmv_gbp": gmv_gbp})
    return priced_rows


async def dashboard_metrics(session: AsyncSession, *, requested_days: int) -> AdminDashboardMetrics:
    """The rolling-window charts: bookings created, bookings paid, signups, and open disputes."""
    period_days = domain.resolve_metrics_days(requested_days)
    days = domain.date_range(period_days)

    created_rows = await repository.bookings_created_in_range(session, days)
    paid_rows = await _with_gmv_fallback(session, await repository.bookings_paid_in_range(session, days))
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
    session: AsyncSession,
    *,
    from_date_raw: str | None,
    to_date_raw: str | None,
    category_offset: int = 0,
    category_limit: int = DEFAULT_LIST_LIMIT,
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
    categories = list(built.get("by_category") or [])
    built["by_category_chart"] = categories
    built["by_category"] = categories[category_offset : category_offset + category_limit]
    built["by_category_total"] = len(categories)
    built["category_offset"] = category_offset
    built["category_limit"] = category_limit
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
