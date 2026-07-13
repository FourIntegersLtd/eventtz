"""Admin dashboard counts and financial reporting."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.admin._helpers import opt_admin_ts
from app.features.admin.booking_diagnostics import count_bookings_needing_support_attention
from app.features.bookings.pricing import build_pricing_breakdown
from app.features.bookings import _paid_at_iso

logger = get_logger(__name__)

#: payment_status values that represent money Eventtz has actually collected from the client
#: (superset of payout_released — the vendor may or may not have been paid out yet).
_PAID_PAYMENT_STATUSES = ["paid", "payout_released", "partially_refunded"]


def _count_rows(
    table: str,
    *,
    eq: dict[str, Any] | None = None,
    not_null: str | None = None,
) -> int:
    if get_settings().local_auth_mode:
        return 0
    try:
        q = get_client().table(table).select("id", count="exact")
        if eq:
            for k, v in eq.items():
                q = q.eq(k, v)
        if not_null:
            q = q.not_.is_(not_null, "null")
        res = q.execute()
        return int(getattr(res, "count", None) or 0)
    except Exception as e:
        logger.warning("_count_rows %s failed: %s", table, e)
        return 0


def get_admin_dashboard_summary() -> dict[str, Any]:
    if get_settings().local_auth_mode:
        return {
            "users_client": 0,
            "users_vendor": 0,
            "users_admin": 0,
            "vendors_pending": 0,
            "vendors_approved": 0,
            "vendors_banned": 0,
            "bookings_pending": 0,
            "bookings_accepted": 0,
            "bookings_completed": 0,
            "bookings_declined": 0,
            "bookings_cancelled": 0,
            "bookings_paid_count": 0,
            "bookings_needing_support": 0,
            "conversations_count": 0,
            "reviews_count": 0,
        }

    uc = _count_rows("users", eq={"user_type": "client"})
    uv = _count_rows("users", eq={"user_type": "vendor"})
    ua = _count_rows("users", eq={"user_type": "admin"})

    vp = _count_rows("vendors", eq={"approval_status": "pending"})
    vok = _count_rows("vendors", eq={"approval_status": "approved"})
    vb = _count_rows("vendors", eq={"approval_status": "banned"})

    bp = _count_rows("booking_requests", eq={"status": "pending"})
    ba = _count_rows("booking_requests", eq={"status": "accepted"})
    bc = _count_rows("booking_requests", eq={"status": "completed"})
    bd = _count_rows("booking_requests", eq={"status": "declined"})
    bcn = _count_rows("booking_requests", eq={"status": "cancelled"})
    bpaid = _count_rows("booking_requests", not_null="paid_at")

    conv = _count_rows("conversations")
    rev = _count_rows("booking_reviews")
    bsupport = count_bookings_needing_support_attention()

    return {
        "users_client": uc,
        "users_vendor": uv,
        "users_admin": ua,
        "vendors_pending": vp,
        "vendors_approved": vok,
        "vendors_banned": vb,
        "bookings_pending": bp,
        "bookings_accepted": ba,
        "bookings_completed": bc,
        "bookings_declined": bd,
        "bookings_cancelled": bcn,
        "bookings_paid_count": bpaid,
        "bookings_needing_support": bsupport,
        "conversations_count": conv,
        "reviews_count": rev,
    }


def _parse_financials_day(iso: str | None) -> str | None:
    if not iso:
        return None
    s = str(iso).strip()
    return s[:10] if len(s) >= 10 else None


def _financials_chart_range(
    date_from: str | None,
    date_to: str | None,
) -> tuple[date, date]:
    today = datetime.now(timezone.utc).date()
    if date_from and len(date_from) >= 10:
        start = date.fromisoformat(date_from[:10])
    else:
        start = today - timedelta(days=29)
    if date_to and len(date_to) >= 10:
        end = date.fromisoformat(date_to[:10])
    else:
        end = today
    if start > end:
        start, end = end, start
    if (end - start).days > 366:
        start = end - timedelta(days=366)
    return start, end


def _iter_financials_days(start: date, end: date) -> list[str]:
    out: list[str] = []
    d = start
    while d <= end:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


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


def _iter_paid_bookings_for_financials(
    date_from: str | None,
    date_to: str | None,
) -> list[dict[str, Any]]:
    client = get_client()
    q = client.table("booking_requests").select("*").in_("payment_status", _PAID_PAYMENT_STATUSES)
    if date_from:
        q = q.gte("paid_at", date_from)
    if date_to:
        q = q.lte("paid_at", date_to)
    try:
        res = q.order("paid_at", desc=False).limit(5000).execute()
    except Exception as e:
        logger.warning("financials fetch failed: %s", e, exc_info=True)
        return []
    return [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]


def get_financials_summary(
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    settings = get_settings()
    fee_pct = float(settings.booking_service_fee_percent or 5)
    chart_start, chart_end = _financials_chart_range(date_from, date_to)
    daily_buckets: dict[str, dict[str, float | int]] = {
        d: {"count": 0, "gmv_gbp": 0.0, "platform_fee_gbp": 0.0, "vendor_portion_gbp": 0.0}
        for d in _iter_financials_days(chart_start, chart_end)
    }

    if settings.local_auth_mode:
        return {
            "period_from": date_from,
            "period_to": date_to,
            "paid_booking_count": 0,
            "gmv_gbp": 0.0,
            "platform_fee_gbp": 0.0,
            "vendor_portion_gbp": 0.0,
            "service_fee_percent": fee_pct,
            "payout_released_gbp": 0.0,
            "held_in_platform_balance_gbp": 0.0,
            "daily": [
                {
                    "date": d,
                    "count": 0,
                    "gmv_gbp": 0.0,
                    "platform_fee_gbp": 0.0,
                    "vendor_portion_gbp": 0.0,
                }
                for d in sorted(daily_buckets.keys())
            ],
        }

    rows = _iter_paid_bookings_for_financials(date_from, date_to)
    gmv = 0.0
    vportion = 0.0
    pfee = 0.0
    payout_released = 0.0
    held_in_balance = 0.0
    for row in rows:
        li = row.get("line_items")
        if not isinstance(li, list):
            li = []
        va = row.get("vendor_adjustments")
        pb = build_pricing_breakdown(line_items=li, vendor_adjustments=va)
        row_gmv = _booking_gmv_gbp(row)
        gmv += row_gmv
        row_vportion = 0.0
        row_pfee = 0.0
        try:
            row_vportion = float(pb.get("vendor_portion_gbp") or 0)
            vportion += row_vportion
        except (TypeError, ValueError):
            pass
        try:
            row_pfee = float(pb.get("service_fee_gbp") or 0)
            pfee += row_pfee
        except (TypeError, ValueError):
            pass
        # Prefer the snapshot captured at payment time; fall back to the live pricing recompute
        # for bookings paid before that snapshot existed.
        row_vendor_amount = row.get("vendor_amount_gbp")
        try:
            row_vendor_amount = (
                float(row_vendor_amount)
                if row_vendor_amount is not None
                else float(pb.get("vendor_portion_gbp") or 0)
            )
        except (TypeError, ValueError):
            row_vendor_amount = 0.0
        if str(row.get("payment_status") or "") == "payout_released":
            payout_released += row_vendor_amount
        elif str(row.get("payment_status") or "") == "paid":
            held_in_balance += row_vendor_amount

        day = _parse_financials_day(_paid_at_iso(row))
        if day and day in daily_buckets:
            daily_buckets[day]["count"] = int(daily_buckets[day]["count"]) + 1
            daily_buckets[day]["gmv_gbp"] = float(daily_buckets[day]["gmv_gbp"]) + row_gmv
            daily_buckets[day]["platform_fee_gbp"] = (
                float(daily_buckets[day]["platform_fee_gbp"]) + row_pfee
            )
            daily_buckets[day]["vendor_portion_gbp"] = (
                float(daily_buckets[day]["vendor_portion_gbp"]) + row_vportion
            )

    n = len(rows)
    return {
        "period_from": date_from,
        "period_to": date_to,
        "paid_booking_count": n,
        "gmv_gbp": round(gmv, 2),
        "platform_fee_gbp": round(pfee, 2),
        "vendor_portion_gbp": round(vportion, 2),
        "service_fee_percent": fee_pct,
        "payout_released_gbp": round(payout_released, 2),
        "held_in_platform_balance_gbp": round(held_in_balance, 2),
        "daily": [
            {
                "date": d,
                "count": int(daily_buckets[d]["count"]),
                "gmv_gbp": round(float(daily_buckets[d]["gmv_gbp"]), 2),
                "platform_fee_gbp": round(float(daily_buckets[d]["platform_fee_gbp"]), 2),
                "vendor_portion_gbp": round(float(daily_buckets[d]["vendor_portion_gbp"]), 2),
            }
            for d in sorted(daily_buckets.keys())
        ],
    }


def financials_export_csv_bytes(
    date_from: str | None,
    date_to: str | None,
) -> bytes:
    rows = _iter_paid_bookings_for_financials(date_from, date_to)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "booking_id",
            "status",
            "payment_status",
            "event_name",
            "paid_at",
            "client_total_gbp",
            "vendor_portion_gbp",
            "service_fee_gbp",
            "payment_amount_gbp",
            "payout_released_at",
        ],
    )
    for row in rows:
        li = row.get("line_items")
        if not isinstance(li, list):
            li = []
        va = row.get("vendor_adjustments")
        pb = build_pricing_breakdown(line_items=li, vendor_adjustments=va)
        pamt = row.get("payment_amount_gbp")
        w.writerow(
            [
                str(row.get("id", "")),
                str(row.get("status", "")),
                str(row.get("payment_status", "")),
                str(row.get("event_name", "")),
                _paid_at_iso(row) or "",
                pb.get("client_total_gbp"),
                pb.get("vendor_portion_gbp"),
                pb.get("service_fee_gbp"),
                float(pamt) if pamt is not None else "",
                opt_admin_ts(row.get("payout_released_at")) or "",
            ],
        )
    return buf.getvalue().encode("utf-8")
