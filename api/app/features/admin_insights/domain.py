"""Pure read-model maths for the admin console's dashboards, analytics and insights.

No I/O: every function here takes plain dicts/lists the repository already
fetched and returns the shape a schema will serialize. Kept in this slice
rather than reused from `bookings`/`vendors` because the cross-slice import
guard (`tests/guards/test_slices_call_services_only.py`) only allows a slice
to see another slice's `service*`/`schemas`/`errors`/`jobs` modules, and the
baseline's needs-attention/funnel helpers take repository-shaped rows that
live in modules outside that public surface.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

#: `booking_requests.payment_status` values where Eventtz has actually collected
#: money from the client (mirrors `backend/app/features/admin/dashboard_queries.py`).
PAID_PAYMENT_STATUSES = ("paid", "payout_released", "partially_refunded")

#: The four chart windows `/admin/dashboard-metrics` accepts; anything else in the
#: query's allowed [7, 90] range still falls back to 30 (baseline quirk, frozen).
ALLOWED_METRICS_DAYS = frozenset({7, 30, 60, 90})

#: How many of the most recently updated bookings the support-attention count scans
#: (baseline's `count_bookings_needing_support_attention(scan_limit=300)`).
SUPPORT_ATTENTION_SCAN_LIMIT = 300


def today_utc() -> date:
    """The current UTC calendar date, as a single seam tests can lean on if needed."""
    return datetime.now(UTC).date()


def date_range(days: int) -> list[str]:
    """`days` consecutive `YYYY-MM-DD` strings, ascending, ending today (UTC inclusive)."""
    end = today_utc()
    start = end - timedelta(days=days - 1)
    out: list[str] = []
    cursor = start
    while cursor <= end:
        out.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return out


def resolve_metrics_days(requested: int) -> int:
    """The chart window to actually use: `requested` if it is one of the four allowed sizes, else 30."""
    return requested if requested in ALLOWED_METRICS_DAYS else 30


def day_key(value: Any) -> str | None:
    """The `YYYY-MM-DD` prefix of an ISO timestamp/date, or `None` for anything shorter."""
    if not value:
        return None
    text = str(value).strip()
    return text[:10] if len(text) >= 10 else None


def month_key(value: Any) -> str | None:
    """The `YYYY-MM` prefix of an ISO timestamp/date (mirrors baseline's `_month_key`)."""
    day = day_key(value)
    return day[:7] if day else None


def build_booking_created_buckets(days: list[str], rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One `{date, count, gmv_gbp}` row per day: bookings created that day."""
    counts = dict.fromkeys(days, 0)
    for row in rows:
        day = day_key(row.get("created_at"))
        if day in counts:
            counts[day] += 1
    return [{"date": day, "count": counts[day], "gmv_gbp": 0.0} for day in days]


def build_booking_paid_buckets(days: list[str], rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One `{date, count, gmv_gbp}` row per day: bookings paid that day, and their takings.

    Each row must already carry a `gmv_gbp` figure (the service layer fills this in:
    the stored `payment_amount_gbp` snapshot where present, else a priced breakdown of
    the booking's line items — see `service.py`'s `_with_gmv_fallback`, which mirrors
    the baseline's `build_pricing_breakdown_for_booking_row` fallback). A row without a
    usable figure at all contributes to `count` but not `gmv_gbp`.
    """
    counts = dict.fromkeys(days, 0)
    totals = dict.fromkeys(days, 0.0)
    for row in rows:
        day = day_key(row.get("paid_at"))
        if day not in counts:
            continue
        counts[day] += 1
        amount = row.get("gmv_gbp")
        if amount is not None:
            totals[day] += float(amount)
    return [{"date": day, "count": counts[day], "gmv_gbp": round(totals[day], 2)} for day in days]


def build_signup_buckets(days: list[str], rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One `{date, clients, vendors}` row per day: accounts created that day, by type."""
    clients = dict.fromkeys(days, 0)
    vendors = dict.fromkeys(days, 0)
    for row in rows:
        day = day_key(row.get("created_at"))
        if day not in clients:
            continue
        user_type = row.get("user_type")
        if user_type == "client":
            clients[day] += 1
        elif user_type == "vendor":
            vendors[day] += 1
    return [{"date": day, "clients": clients[day], "vendors": vendors[day]} for day in days]


def _event_is_over(row: dict[str, Any]) -> bool:
    """True once the booking's last event day has finished (UTC calendar date)."""
    raw = row.get("event_end_date") or row.get("event_date")
    day = day_key(raw)
    if not day:
        return False
    try:
        return date.fromisoformat(day) < today_utc()
    except ValueError:
        return False


def booking_needs_attention(row: dict[str, Any], *, payouts_enabled: bool, has_active_dispute: bool) -> bool:
    """Whether this booking would show a needs-attention flag on the admin console.

    A simplified read of `backend/app/features/admin/booking_diagnostics.py`'s
    flag set (payment stuck unmarked, a stale checkout, a cancellation whose
    refund never landed, a dispute sitting on paid money, a support hold, an
    event that ended without both sides confirming completion, or a payout that
    cannot go out). Good enough for a dashboard count; the full per-flag detail
    with labels and a suggested action belongs to the bookings slice.
    """
    status = row.get("status")
    payment_status = row.get("payment_status")
    both_confirmed = bool(row.get("client_completion_confirmed_at")) and bool(
        row.get("vendor_completion_confirmed_at")
    )

    checkout_pending = payment_status in ("unpaid", "pending") and row.get("stripe_checkout_session_id")
    refund_missing = payment_status not in ("refunded", "partially_refunded")

    if payment_status == "pending":
        return True
    if status == "accepted" and checkout_pending:
        return True
    if status == "cancelled" and row.get("paid_at") and refund_missing:
        return True
    if has_active_dispute and payment_status == "paid":
        return True
    if row.get("support_hold") and payment_status == "paid":
        return True
    paid_and_accepted = status == "accepted" and payment_status == "paid" and not both_confirmed
    return bool(paid_and_accepted and (_event_is_over(row) or not payouts_enabled))


def count_bookings_needing_support(
    rows: list[dict[str, Any]],
    *,
    payouts_enabled_by_vendor: dict[str, bool],
    disputed_booking_ids: set[str],
) -> int:
    """How many of the scanned bookings carry at least one needs-attention flag."""
    total = 0
    for row in rows:
        booking_id = str(row.get("id") or "")
        vendor_id = str(row.get("vendor_user_id") or "")
        if booking_needs_attention(
            row,
            payouts_enabled=payouts_enabled_by_vendor.get(vendor_id, False),
            has_active_dispute=booking_id in disputed_booking_ids,
        ):
            total += 1
    return total


def primary_category(vendor: dict[str, Any] | None) -> str:
    """A vendor's first declared service category, or `"unknown"` without one."""
    if not vendor:
        return "unknown"
    services = vendor.get("services_offered")
    if isinstance(services, list) and services:
        return str(services[0]).strip().lower() or "unknown"
    raw_payload = vendor.get("payload")
    payload: dict[str, Any] = raw_payload if isinstance(raw_payload, dict) else {}
    offered = payload.get("servicesOffered")
    if isinstance(offered, list) and offered:
        return str(offered[0]).strip().lower() or "unknown"
    return "unknown"


def location_for_booking(vendor: dict[str, Any] | None, booking: dict[str, Any]) -> str:
    """A vendor's normalised base city, falling back to the booking's event postcode area."""
    if vendor:
        city = str(vendor.get("base_city_normalized") or "").strip()
        if city:
            return city
        raw_payload = vendor.get("payload")
        payload: dict[str, Any] = raw_payload if isinstance(raw_payload, dict) else {}
        base = str(payload.get("baseCity") or "").strip()
        if base:
            return base.lower()
    postcode = str(booking.get("event_postcode") or "").strip()
    if postcode:
        parts = postcode.split()
        return parts[0].upper() if parts else postcode.upper()
    return "unknown"


def _is_paid(payment_status: str) -> bool:
    """Whether Eventtz has collected money for this booking (see `PAID_PAYMENT_STATUSES`)."""
    return payment_status in PAID_PAYMENT_STATUSES


def _booking_revenue_gbp(row: dict[str, Any]) -> float:
    """A completed booking's contribution to revenue: the stored payment amount, or zero."""
    amount = row.get("payment_amount_gbp")
    try:
        return float(amount) if amount is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _enrich_breakdown(rows: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Add conversion/accept rates and average booking value to a category or location bucket."""
    out: list[dict[str, Any]] = []
    for row in rows.values():
        enquiries = int(row["enquiries"])
        accepted = int(row["accepted"])
        completed = int(row["completed"])
        revenue_gbp = float(row["revenue_gbp"])
        avg_value = round(revenue_gbp / completed, 2) if completed else 0.0
        out.append(
            {
                **row,
                "conversion_rate": round(completed / enquiries, 4) if enquiries else 0.0,
                "accept_rate": round(accepted / enquiries, 4) if enquiries else 0.0,
                "avg_booking_value_gbp": avg_value,
                "revenue_gbp": round(revenue_gbp, 2),
            }
        )
    out.sort(key=lambda bucket: bucket["enquiries"], reverse=True)
    return out


def build_marketplace_analytics(
    *,
    from_date: str,
    to_date: str,
    enquiries: list[dict[str, Any]],
    vendors_by_id: dict[str, dict[str, Any]],
    vendors_total: int,
    vendors_active: int,
    avg_rating: float,
    review_count: int,
    profile_views: int,
    vendor_reminders: int,
    client_nudges: int,
    multi_batches: int,
) -> dict[str, Any]:
    """The `/admin/marketplace-analytics` response: the funnel over client-initiated enquiries.

    `enquiries` is every `booking_requests` row with `initiator="client"` created in
    range (`docs/domain-rules.md`: "Enquiry = booking_requests with initiator='client'").
    """
    total_enquiries = len(enquiries)
    accepted = [
        row for row in enquiries if row.get("accepted_at") or row.get("status") in ("accepted", "completed")
    ]
    paid = [row for row in accepted if _is_paid(str(row.get("payment_status") or ""))]
    completed = [row for row in enquiries if row.get("status") == "completed" or row.get("completed_at")]

    response_times = [
        int(row["vendor_response_time_seconds"])
        for row in enquiries
        if row.get("vendor_response_time_seconds") is not None
    ]
    responded = len(response_times)

    def _within(seconds: int) -> int:
        """How many responses landed within `seconds` of the enquiry."""
        return sum(1 for value in response_times if value <= seconds)

    def _rate(count: int) -> float | None:
        """A fraction of `responded`, or `None` when nobody has replied yet."""
        return round(count / responded, 4) if responded else None

    # Time series by month: every enquiry counts against the month it was created in;
    # a completed one counts (separately) against the month it finished in, falling
    # back to when it was last touched and then to when it was created (mirrors
    # baseline's `completed_at or updated_at or created_at`, for rows with no
    # `completed_at` of their own).
    enquiries_by_month: dict[str, int] = {}
    completed_by_month: dict[str, int] = {}
    for row in enquiries:
        month = month_key(row.get("created_at"))
        if month:
            enquiries_by_month[month] = enquiries_by_month.get(month, 0) + 1
        if row.get("status") == "completed" or row.get("completed_at"):
            finished_at = row.get("completed_at") or row.get("updated_at") or row.get("created_at")
            completed_month = month_key(finished_at)
            if completed_month:
                completed_by_month[completed_month] = completed_by_month.get(completed_month, 0) + 1

    by_category: dict[str, dict[str, Any]] = {}
    by_location: dict[str, dict[str, Any]] = {}
    failure_counts: dict[str, int] = {}
    vendor_stats: dict[str, dict[str, Any]] = {}

    for row in enquiries:
        vendor_id = str(row.get("vendor_user_id") or "")
        vendor = vendors_by_id.get(vendor_id)
        category = primary_category(vendor)
        location = location_for_booking(vendor, row)
        for bucket, key in ((by_category, category), (by_location, location)):
            if key not in bucket:
                bucket[key] = {
                    "key": key,
                    "enquiries": 0,
                    "accepted": 0,
                    "paid": 0,
                    "completed": 0,
                    "failed": 0,
                    "revenue_gbp": 0.0,
                }
            bucket[key]["enquiries"] += 1

        stats = vendor_stats.setdefault(
            vendor_id,
            {
                "enquiries": 0,
                "accepted": 0,
                "paid": 0,
                "completed": 0,
                "response_seconds": [],
                "revenue_gbp": 0.0,
            },
        )
        stats["enquiries"] += 1
        is_accepted = bool(row.get("accepted_at") or row.get("status") in ("accepted", "completed"))
        is_paid_row = is_accepted and _is_paid(str(row.get("payment_status") or ""))
        is_completed = row.get("status") == "completed" or bool(row.get("completed_at"))
        if is_accepted:
            by_category[category]["accepted"] += 1
            by_location[location]["accepted"] += 1
            stats["accepted"] += 1
        if is_paid_row:
            by_category[category]["paid"] += 1
            by_location[location]["paid"] += 1
            stats["paid"] += 1
        if is_completed:
            revenue = _booking_revenue_gbp(row)
            by_category[category]["completed"] += 1
            by_location[location]["completed"] += 1
            by_category[category]["revenue_gbp"] += revenue
            by_location[location]["revenue_gbp"] += revenue
            stats["completed"] += 1
            stats["revenue_gbp"] += revenue
        if row.get("failure_reason") and not is_completed:
            reason = str(row["failure_reason"])
            failure_counts[reason] = failure_counts.get(reason, 0) + 1
            by_category[category]["failed"] += 1
            by_location[location]["failed"] += 1
        if row.get("vendor_response_time_seconds") is not None:
            stats["response_seconds"].append(int(row["vendor_response_time_seconds"]))

    category_rows = _enrich_breakdown(by_category)
    location_rows = _enrich_breakdown(by_location)

    def _recruitment_hints(rows: list[dict[str, Any]], noun: str, key_field: str) -> list[dict[str, Any]]:
        """Categories/locations with enough demand and too high a failure rate to leave unstaffed."""
        hints = []
        for row in rows:
            enquiries_count = row["enquiries"]
            if enquiries_count < 5:
                continue
            if (row["failed"] / enquiries_count if enquiries_count else 0) < 0.25:
                continue
            hints.append(
                {
                    key_field: row["key"],
                    "enquiries": enquiries_count,
                    "failed": row["failed"],
                    "message": f"High demand for {row['key']} - consider recruiting more {noun}",
                }
            )
        return hints[:5]

    top_vendors = []
    for vendor_id, stats in vendor_stats.items():
        if not vendor_id or stats["enquiries"] < 1:
            continue
        vendor = vendors_by_id.get(vendor_id) or {}
        raw_payload = vendor.get("payload")
        payload: dict[str, Any] = raw_payload if isinstance(raw_payload, dict) else {}
        name = str(payload.get("businessName") or vendor_id)[:80]
        response_seconds = stats["response_seconds"]
        vendor_enquiries = stats["enquiries"]
        conversion_rate = round(stats["completed"] / vendor_enquiries, 4) if vendor_enquiries else 0.0
        avg_response_seconds = (
            round(sum(response_seconds) / len(response_seconds), 1) if response_seconds else None
        )
        top_vendors.append(
            {
                "vendor_user_id": vendor_id,
                "business_name": name,
                "enquiries": vendor_enquiries,
                "completed": stats["completed"],
                "conversion_rate": conversion_rate,
                "avg_response_seconds": avg_response_seconds,
                "revenue_gbp": round(stats["revenue_gbp"], 2),
            }
        )
    top_vendors.sort(key=lambda vendor: (vendor["completed"], vendor["revenue_gbp"]), reverse=True)

    completed_paid_values = [
        _booking_revenue_gbp(row)
        for row in completed
        if _is_paid(str(row.get("payment_status") or "")) and _booking_revenue_gbp(row) > 0
    ]
    avg_booking_value = (
        round(sum(completed_paid_values) / len(completed_paid_values), 2) if completed_paid_values else 0.0
    )

    months = sorted(set(enquiries_by_month) | set(completed_by_month))

    return {
        "success": True,
        "from_date": from_date,
        "to_date": to_date,
        "overview": {
            "vendors_total": vendors_total,
            "vendors_active": vendors_active,
            "enquiries": total_enquiries,
            "accepted": len(accepted),
            "paid": len(paid),
            "completed": len(completed),
            "enquiry_to_acceptance_rate": (
                round(len(accepted) / total_enquiries, 4) if total_enquiries else 0.0
            ),
            "acceptance_to_payment_rate": round(len(paid) / len(accepted), 4) if accepted else 0.0,
            "overall_conversion_rate": (
                round(len(completed) / total_enquiries, 4) if total_enquiries else 0.0
            ),
            "avg_booking_value_gbp": avg_booking_value,
            "avg_vendor_response_seconds": round(sum(response_times) / len(response_times), 1)
            if response_times
            else None,
            "reply_within_1h_rate": _rate(_within(3600)),
            "reply_within_6h_rate": _rate(_within(6 * 3600)),
            "reply_within_24h_rate": _rate(_within(24 * 3600)),
            "enquiry_vendor_reminders": vendor_reminders,
            "enquiry_client_nudges": client_nudges,
            "enquiry_multi_batches": multi_batches,
            "avg_customer_rating": avg_rating,
            "review_count": review_count,
            "profile_views": profile_views,
            "unfulfilled": sum(failure_counts.values()),
        },
        "enquiries_by_month": [
            {"month": month, "count": enquiries_by_month.get(month, 0)} for month in months
        ],
        "completed_by_month": [
            {"month": month, "count": completed_by_month.get(month, 0)} for month in months
        ],
        "by_category": category_rows,
        "by_location": location_rows,
        "failure_reasons": [
            {"reason": reason, "count": count}
            for reason, count in sorted(failure_counts.items(), key=lambda item: -item[1])
        ],
        "top_vendors": top_vendors[:20],
        "recruitment_hints": {
            "categories": _recruitment_hints(category_rows, "vendors", "category"),
            "locations": _recruitment_hints(location_rows, "supply", "location"),
        },
    }


def build_vendor_insights(
    *,
    user_id: str,
    review_average: float | None,
    review_count: int,
    booking_rows: list[dict[str, Any]],
    open_disputes: int,
) -> dict[str, Any]:
    """The `/admin/vendors/{user_id}/insights` response for one vendor.

    Never 404s: an unknown or malformed id simply matches no bookings or reviews,
    so every count comes back zero (the baseline's behaviour, frozen in the acceptance
    suite as `test_vendor_insights_unknown_vendor_is_all_zero`).
    """
    bookings_by_status: dict[str, int] = {}
    bookings_by_month: dict[str, dict[str, int]] = {}
    for row in booking_rows:
        status = str(row.get("status") or "unknown")
        bookings_by_status[status] = bookings_by_status.get(status, 0) + 1
        month = month_key(row.get("created_at"))
        if month:
            bookings_by_month.setdefault(month, {})
            bookings_by_month[month][status] = bookings_by_month[month].get(status, 0) + 1

    status_keys = sorted(bookings_by_status.keys())
    month_rows = [
        {"month": month, **{status: bookings_by_month[month].get(status, 0) for status in status_keys}}
        for month in sorted(bookings_by_month.keys())
    ]

    return {
        "success": True,
        "user_id": user_id,
        "review_average": review_average,
        "review_count": review_count,
        "bookings_total": sum(bookings_by_status.values()),
        "bookings_by_status": bookings_by_status,
        "bookings_by_month": month_rows,
        "open_disputes_on_bookings": open_disputes,
        "explore_path": f"/client/browse/{user_id}",
    }
