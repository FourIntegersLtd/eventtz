"""Vendor-facing marketplace analytics for the portal."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.admin.dashboard_queries import _PAID_PAYMENT_STATUSES

logger = get_logger(__name__)


def _safe_float(v: Any) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _month_key(iso: Any) -> str | None:
    if not iso:
        return None
    s = str(iso).strip()
    return s[:7] if len(s) >= 7 else None


def get_vendor_analytics(vendor_user_id: str, *, days: int = 90) -> dict[str, Any]:
    if get_settings().local_auth_mode:
        return {"success": True, "overview": {}, "series": {}, "funnel": {}}

    days = max(7, min(days, 365))
    start = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select(
                "id,status,payment_status,initiator,created_at,accepted_at,completed_at,"
                "vendor_response_time_seconds,payment_amount_gbp,vendor_amount_gbp,"
                "event_date,failure_reason",
            )
            .eq("vendor_user_id", vendor_user_id)
            .eq("initiator", "client")
            .gte("created_at", start)
            .order("created_at", desc=False)
            .limit(2000)
            .execute()
        )
        enquiries = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("vendor_analytics: load failed")
        enquiries = []

    accepted = [e for e in enquiries if e.get("accepted_at") or e.get("status") in ("accepted", "completed")]
    paid = [e for e in accepted if str(e.get("payment_status") or "") in _PAID_PAYMENT_STATUSES]
    completed = [e for e in enquiries if e.get("status") == "completed" or e.get("completed_at")]
    pending = [e for e in enquiries if e.get("status") == "pending"]
    expired = [e for e in pending if e.get("failure_reason") == "VENDOR_NO_RESPONSE"]

    today = datetime.now(timezone.utc).date()
    upcoming = 0
    for e in enquiries:
        if e.get("status") not in ("accepted", "completed"):
            continue
        ed = str(e.get("event_date") or "")[:10]
        try:
            if date.fromisoformat(ed) >= today:
                upcoming += 1
        except ValueError:
            pass

    rts = [
        int(e["vendor_response_time_seconds"])
        for e in enquiries
        if e.get("vendor_response_time_seconds") is not None
    ]
    revenue = sum(_safe_float(e.get("vendor_amount_gbp") or e.get("payment_amount_gbp")) for e in completed)
    avg_value = round(revenue / len(completed), 2) if completed else 0.0

    # Ratings
    avg_rating = 0.0
    rating_count = 0
    ratings_by_month: dict[str, list[int]] = defaultdict(list)
    try:
        rev = (
            get_client()
            .table("booking_reviews")
            .select("rating,created_at")
            .eq("vendor_user_id", vendor_user_id)
            .is_("hidden_at", "null")
            .gte("created_at", start)
            .limit(1000)
            .execute()
        )
        for r in getattr(rev, "data", None) or []:
            if not isinstance(r, dict) or r.get("rating") is None:
                continue
            rating = int(r["rating"])
            rating_count += 1
            avg_rating += rating
            mk = _month_key(r.get("created_at"))
            if mk:
                ratings_by_month[mk].append(rating)
        avg_rating = round(avg_rating / rating_count, 2) if rating_count else 0.0
    except Exception:
        logger.exception("vendor_analytics: reviews failed")

    enq_month: dict[str, int] = defaultdict(int)
    rev_month: dict[str, float] = defaultdict(float)
    resp_month: dict[str, list[int]] = defaultdict(list)
    for e in enquiries:
        mk = _month_key(e.get("created_at"))
        if mk:
            enq_month[mk] += 1
        if e.get("vendor_response_time_seconds") is not None and mk:
            resp_month[mk].append(int(e["vendor_response_time_seconds"]))
        if e.get("status") == "completed" or e.get("completed_at"):
            mk2 = _month_key(e.get("completed_at") or e.get("created_at"))
            if mk2:
                rev_month[mk2] += _safe_float(e.get("vendor_amount_gbp") or e.get("payment_amount_gbp"))

    months = sorted(set(enq_month) | set(rev_month) | set(resp_month) | set(ratings_by_month))

    profile_views = 0
    try:
        pv = (
            get_client()
            .table("marketplace_events")
            .select("id", count="exact")
            .eq("event_name", "vendor_profile_viewed")
            .eq("vendor_user_id", vendor_user_id)
            .gte("created_at", start)
            .execute()
        )
        profile_views = int(getattr(pv, "count", 0) or 0)
    except Exception:
        profile_views = 0

    return {
        "success": True,
        "period_days": days,
        "overview": {
            "enquiries": len(enquiries),
            "completed": len(completed),
            "total_revenue_gbp": round(revenue, 2),
            "avg_booking_value_gbp": avg_value,
            "avg_customer_rating": avg_rating,
            "review_count": rating_count,
            "avg_response_seconds": round(sum(rts) / len(rts), 1) if rts else None,
            "conversion_rate": round(len(completed) / len(enquiries), 4) if enquiries else 0.0,
            "pending_enquiries": len(pending),
            "expired_enquiries": len(expired),
            "upcoming_bookings": upcoming,
            "profile_views": profile_views,
        },
        "funnel": {
            "profile_views": profile_views,
            "enquiries": len(enquiries),
            "accepted": len(accepted),
            "paid": len(paid),
            "completed": len(completed),
        },
        "enquiries_by_month": [{"month": m, "count": enq_month.get(m, 0)} for m in months],
        "revenue_by_month": [
            {"month": m, "revenue_gbp": round(rev_month.get(m, 0.0), 2)} for m in months
        ],
        "response_time_by_month": [
            {
                "month": m,
                "avg_seconds": round(sum(resp_month[m]) / len(resp_month[m]), 1)
                if resp_month.get(m)
                else None,
            }
            for m in months
        ],
        "rating_by_month": [
            {
                "month": m,
                "avg_rating": round(sum(ratings_by_month[m]) / len(ratings_by_month[m]), 2)
                if ratings_by_month.get(m)
                else None,
            }
            for m in months
        ],
    }
