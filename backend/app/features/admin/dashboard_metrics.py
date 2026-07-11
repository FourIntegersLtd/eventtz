"""Admin dashboard time-series metrics for charts."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.admin.dashboard_queries import _PAID_PAYMENT_STATUSES
from app.features.bookings.pricing import build_pricing_breakdown
from app.features.bookings import _paid_at_iso

logger = get_logger(__name__)

_ALLOWED_DAYS = frozenset({7, 30, 90})


def _parse_day(iso: str | None) -> str | None:
    if not iso:
        return None
    s = str(iso).strip()
    if len(s) >= 10:
        return s[:10]
    return None


def _date_range(days: int) -> list[str]:
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    out: list[str] = []
    d = start
    while d <= today:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def _empty_buckets(days: int) -> tuple[dict[str, dict[str, float | int]], dict[str, dict[str, int]]]:
    booking_buckets: dict[str, dict[str, float | int]] = {
        d: {"count": 0, "gmv_gbp": 0.0} for d in _date_range(days)
    }
    signup_buckets: dict[str, dict[str, int]] = {
        d: {"clients": 0, "vendors": 0} for d in _date_range(days)
    }
    return booking_buckets, signup_buckets


def _booking_gmv_gbp(row: dict[str, Any]) -> float:
    pamt = row.get("payment_amount_gbp")
    if pamt is not None:
        try:
            return float(pamt)
        except (TypeError, ValueError):
            pass
    li = row.get("line_items")
    if not isinstance(li, list):
        li = []
    va = row.get("vendor_adjustments")
    pb = build_pricing_breakdown(line_items=li, vendor_adjustments=va)
    try:
        return float(pb.get("client_total_gbp") or 0)
    except (TypeError, ValueError):
        return 0.0


def _count_open_disputes() -> int:
    try:
        res = (
            get_client()
            .table("dispute_cases")
            .select("id", count="exact")
            .in_("status", ["open", "under_review"])
            .execute()
        )
        return int(getattr(res, "count", None) or 0)
    except Exception as e:
        logger.warning("_count_open_disputes failed: %s", e)
        return 0


def get_admin_dashboard_metrics(days: int = 30) -> dict[str, Any]:
    period = days if days in _ALLOWED_DAYS else 30
    if get_settings().local_auth_mode:
        empty_bookings, empty_signups = _empty_buckets(period)
        return {
            "period_days": period,
            "bookings_created": [
                {"date": d, "count": int(b["count"]), "gmv_gbp": 0.0}
                for d, b in sorted(empty_bookings.items())
            ],
            "bookings_paid": [
                {"date": d, "count": 0, "gmv_gbp": 0.0} for d in sorted(empty_bookings.keys())
            ],
            "signups": [
                {"date": d, "clients": 0, "vendors": 0} for d in sorted(empty_signups.keys())
            ],
            "open_disputes_count": 0,
        }

    start_dt = datetime.now(timezone.utc).date() - timedelta(days=period - 1)
    start_iso = datetime.combine(start_dt, datetime.min.time(), tzinfo=timezone.utc).isoformat()

    created_buckets, signup_buckets = _empty_buckets(period)
    paid_buckets: dict[str, dict[str, float | int]] = {
        d: {"count": 0, "gmv_gbp": 0.0} for d in created_buckets
    }

    client = get_client()

    try:
        created_res = (
            client.table("booking_requests")
            .select("id,created_at")
            .gte("created_at", start_iso)
            .limit(5000)
            .execute()
        )
        for row in getattr(created_res, "data", None) or []:
            if not isinstance(row, dict):
                continue
            day = _parse_day(row.get("created_at"))
            if day and day in created_buckets:
                created_buckets[day]["count"] = int(created_buckets[day]["count"]) + 1
    except Exception as e:
        logger.warning("dashboard metrics bookings_created failed: %s", e)

    try:
        paid_res = (
            client.table("booking_requests")
            .select("*")
            .in_("payment_status", _PAID_PAYMENT_STATUSES)
            .gte("paid_at", start_iso)
            .limit(5000)
            .execute()
        )
        for row in getattr(paid_res, "data", None) or []:
            if not isinstance(row, dict):
                continue
            day = _parse_day(_paid_at_iso(row))
            if day and day in paid_buckets:
                paid_buckets[day]["count"] = int(paid_buckets[day]["count"]) + 1
                paid_buckets[day]["gmv_gbp"] = float(paid_buckets[day]["gmv_gbp"]) + _booking_gmv_gbp(row)
    except Exception as e:
        logger.warning("dashboard metrics bookings_paid failed: %s", e)

    try:
        users_res = (
            client.table("users")
            .select("id,user_type,created_at")
            .in_("user_type", ["client", "vendor"])
            .gte("created_at", start_iso)
            .limit(5000)
            .execute()
        )
        for row in getattr(users_res, "data", None) or []:
            if not isinstance(row, dict):
                continue
            day = _parse_day(row.get("created_at"))
            ut = str(row.get("user_type") or "")
            if not day or day not in signup_buckets:
                continue
            if ut == "client":
                signup_buckets[day]["clients"] += 1
            elif ut == "vendor":
                signup_buckets[day]["vendors"] += 1
    except Exception as e:
        logger.warning("dashboard metrics signups failed: %s", e)

    open_disputes = _count_open_disputes()

    return {
        "period_days": period,
        "bookings_created": [
            {"date": d, "count": int(created_buckets[d]["count"]), "gmv_gbp": 0.0}
            for d in sorted(created_buckets.keys())
        ],
        "bookings_paid": [
            {
                "date": d,
                "count": int(paid_buckets[d]["count"]),
                "gmv_gbp": round(float(paid_buckets[d]["gmv_gbp"]), 2),
            }
            for d in sorted(paid_buckets.keys())
        ],
        "signups": [
            {"date": d, "clients": signup_buckets[d]["clients"], "vendors": signup_buckets[d]["vendors"]}
            for d in sorted(signup_buckets.keys())
        ],
        "open_disputes_count": open_disputes,
    }
