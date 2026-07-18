"""Admin marketplace funnel analytics (enquiries, conversion, failed demand)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.admin.dashboard_queries import _PAID_PAYMENT_STATUSES

logger = get_logger(__name__)

_BOOKING_SELECT = (
    "id,status,payment_status,initiator,created_at,accepted_at,declined_at,"
    "vendor_first_response_at,vendor_response_time_seconds,paid_at,completed_at,"
    "cancelled_at,cancelled_by,failure_reason,payment_amount_gbp,vendor_amount_gbp,"
    "vendor_user_id,event_postcode,event_address"
)


def _parse_day(iso: Any) -> str | None:
    if not iso:
        return None
    s = str(iso).strip()
    return s[:10] if len(s) >= 10 else None


def _month_key(iso: Any) -> str | None:
    d = _parse_day(iso)
    return d[:7] if d else None


def _is_paid(payment_status: str) -> bool:
    return payment_status in _PAID_PAYMENT_STATUSES


def _safe_float(v: Any) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _date_bounds(from_date: date | None, to_date: date | None) -> tuple[str, str]:
    today = datetime.now(timezone.utc).date()
    end = to_date or today
    start = from_date or (end - timedelta(days=89))
    return start.isoformat(), end.isoformat() + "T23:59:59.999Z"


def _load_client_enquiries(from_iso: str, to_iso: str) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select(_BOOKING_SELECT)
            .eq("initiator", "client")
            .gte("created_at", from_iso)
            .lte("created_at", to_iso)
            .order("created_at", desc=False)
            .limit(5000)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        return [r for r in rows if isinstance(r, dict)]
    except Exception:
        logger.exception("marketplace_analytics: load enquiries failed")
        return []


def _vendor_meta(vendor_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not vendor_ids or get_settings().local_auth_mode:
        return {}
    out: dict[str, dict[str, Any]] = {}
    try:
        # Chunk to avoid URL limits
        for i in range(0, len(vendor_ids), 100):
            chunk = vendor_ids[i : i + 100]
            res = (
                get_client()
                .table("vendors")
                .select("user_id,services_offered,base_city_normalized,approval_status,payload")
                .in_("user_id", chunk)
                .execute()
            )
            for row in getattr(res, "data", None) or []:
                if isinstance(row, dict) and row.get("user_id"):
                    out[str(row["user_id"])] = row
    except Exception:
        logger.exception("marketplace_analytics: vendor meta failed")
    return out


def _primary_category(vendor: dict[str, Any] | None) -> str:
    if not vendor:
        return "unknown"
    services = vendor.get("services_offered")
    if isinstance(services, list) and services:
        return str(services[0]).strip().lower() or "unknown"
    payload = vendor.get("payload") if isinstance(vendor.get("payload"), dict) else {}
    offered = payload.get("servicesOffered")
    if isinstance(offered, list) and offered:
        return str(offered[0]).strip().lower() or "unknown"
    return "unknown"


def _location(vendor: dict[str, Any] | None, booking: dict[str, Any]) -> str:
    if vendor:
        city = str(vendor.get("base_city_normalized") or "").strip()
        if city:
            return city
        payload = vendor.get("payload") if isinstance(vendor.get("payload"), dict) else {}
        base = str(payload.get("baseCity") or "").strip()
        if base:
            return base.lower()
    pc = str(booking.get("event_postcode") or "").strip()
    if pc:
        return pc.split()[0].upper() if pc.split() else pc.upper()
    return "unknown"


def _review_stats() -> tuple[float, int]:
    if get_settings().local_auth_mode:
        return 0.0, 0
    try:
        res = (
            get_client()
            .table("booking_reviews")
            .select("rating")
            .is_("hidden_at", "null")
            .limit(5000)
            .execute()
        )
        ratings = [
            int(r["rating"])
            for r in (getattr(res, "data", None) or [])
            if isinstance(r, dict) and r.get("rating") is not None
        ]
        if not ratings:
            return 0.0, 0
        return round(sum(ratings) / len(ratings), 2), len(ratings)
    except Exception:
        logger.exception("marketplace_analytics: reviews failed")
        return 0.0, 0


def _vendor_counts() -> tuple[int, int]:
    if get_settings().local_auth_mode:
        return 0, 0
    try:
        total = (
            get_client().table("vendors").select("user_id", count="exact").execute()
        )
        approved = (
            get_client()
            .table("vendors")
            .select("user_id", count="exact")
            .eq("approval_status", "approved")
            .eq("status", "submitted")
            .execute()
        )
        return int(getattr(total, "count", 0) or 0), int(getattr(approved, "count", 0) or 0)
    except Exception:
        return 0, 0


def get_marketplace_analytics(
    *,
    from_date: date | None = None,
    to_date: date | None = None,
    country_code: str | None = None,
) -> dict[str, Any]:
    from_iso, to_iso = _date_bounds(from_date, to_date)
    enquiries = _load_client_enquiries(from_iso[:10], to_iso)
    vendor_ids = list({str(r.get("vendor_user_id") or "") for r in enquiries if r.get("vendor_user_id")})
    vendors = _vendor_meta(vendor_ids)

    # Optional country filter via vendor country_code
    if country_code:
        cc = country_code.strip().upper()
        filtered: list[dict[str, Any]] = []
        for e in enquiries:
            vid = str(e.get("vendor_user_id") or "")
            v = vendors.get(vid) or {}
            payload = v.get("payload") if isinstance(v.get("payload"), dict) else {}
            vcc = str(v.get("country_code") or payload.get("countryCode") or "GB").upper()
            if vcc == cc:
                filtered.append(e)
        enquiries = filtered

    total_enquiries = len(enquiries)
    accepted = [e for e in enquiries if e.get("accepted_at") or e.get("status") in ("accepted", "completed")]
    paid = [e for e in accepted if _is_paid(str(e.get("payment_status") or ""))]
    completed = [e for e in enquiries if e.get("status") == "completed" or e.get("completed_at")]
    completed_paid = [e for e in completed if _is_paid(str(e.get("payment_status") or ""))]

    response_times = [
        int(e["vendor_response_time_seconds"])
        for e in enquiries
        if e.get("vendor_response_time_seconds") is not None
    ]
    avg_response = round(sum(response_times) / len(response_times), 1) if response_times else None

    values = [_safe_float(e.get("payment_amount_gbp")) for e in completed_paid if _safe_float(e.get("payment_amount_gbp")) > 0]
    avg_booking_value = round(sum(values) / len(values), 2) if values else 0.0

    avg_rating, review_count = _review_stats()
    vendors_total, vendors_active = _vendor_counts()

    enquiry_to_accept = round(len(accepted) / total_enquiries, 4) if total_enquiries else 0.0
    accept_to_pay = round(len(paid) / len(accepted), 4) if accepted else 0.0
    overall_conversion = round(len(completed) / total_enquiries, 4) if total_enquiries else 0.0

    # Time series by month
    enquiries_by_month: dict[str, int] = defaultdict(int)
    completed_by_month: dict[str, int] = defaultdict(int)
    for e in enquiries:
        mk = _month_key(e.get("created_at"))
        if mk:
            enquiries_by_month[mk] += 1
        if e.get("status") == "completed" or e.get("completed_at"):
            mk2 = _month_key(e.get("completed_at") or e.get("updated_at") or e.get("created_at"))
            if mk2:
                completed_by_month[mk2] += 1

    # By category / location
    by_category: dict[str, dict[str, Any]] = {}
    by_location: dict[str, dict[str, Any]] = {}
    failure_counts: dict[str, int] = defaultdict(int)
    vendor_stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "enquiries": 0,
            "accepted": 0,
            "paid": 0,
            "completed": 0,
            "response_seconds": [],
            "revenue_gbp": 0.0,
        },
    )

    for e in enquiries:
        vid = str(e.get("vendor_user_id") or "")
        v = vendors.get(vid)
        cat = _primary_category(v)
        loc = _location(v, e)
        for bucket, key in ((by_category, cat), (by_location, loc)):
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

        vs = vendor_stats[vid]
        vs["enquiries"] += 1
        is_acc = bool(e.get("accepted_at") or e.get("status") in ("accepted", "completed"))
        is_paid_row = is_acc and _is_paid(str(e.get("payment_status") or ""))
        is_comp = e.get("status") == "completed" or bool(e.get("completed_at"))
        if is_acc:
            by_category[cat]["accepted"] += 1
            by_location[loc]["accepted"] += 1
            vs["accepted"] += 1
        if is_paid_row:
            by_category[cat]["paid"] += 1
            by_location[loc]["paid"] += 1
            vs["paid"] += 1
        if is_comp:
            by_category[cat]["completed"] += 1
            by_location[loc]["completed"] += 1
            vs["completed"] += 1
            rev = _safe_float(e.get("payment_amount_gbp"))
            by_category[cat]["revenue_gbp"] += rev
            by_location[loc]["revenue_gbp"] += rev
            vs["revenue_gbp"] += rev
        if e.get("failure_reason") and not is_comp:
            fr = str(e["failure_reason"])
            failure_counts[fr] += 1
            by_category[cat]["failed"] += 1
            by_location[loc]["failed"] += 1
        if e.get("vendor_response_time_seconds") is not None:
            vs["response_seconds"].append(int(e["vendor_response_time_seconds"]))

    def _enrich_breakdown(rows: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        out = []
        for row in rows.values():
            enq = int(row["enquiries"])
            acc = int(row["accepted"])
            comp = int(row["completed"])
            out.append(
                {
                    **row,
                    "conversion_rate": round(comp / enq, 4) if enq else 0.0,
                    "accept_rate": round(acc / enq, 4) if enq else 0.0,
                    "avg_booking_value_gbp": round(
                        float(row["revenue_gbp"]) / comp,
                        2,
                    )
                    if comp
                    else 0.0,
                    "revenue_gbp": round(float(row["revenue_gbp"]), 2),
                },
            )
        out.sort(key=lambda x: x["enquiries"], reverse=True)
        return out

    category_rows = _enrich_breakdown(by_category)
    location_rows = _enrich_breakdown(by_location)

    # Recruitment hints: high demand + high failed / no vendors
    recruit_categories = [
        {
            "category": r["key"],
            "enquiries": r["enquiries"],
            "failed": r["failed"],
            "message": f"High demand for {r['key']} — consider recruiting more vendors",
        }
        for r in category_rows
        if r["enquiries"] >= 5 and (r["failed"] / r["enquiries"] if r["enquiries"] else 0) >= 0.25
    ][:5]
    recruit_locations = [
        {
            "location": r["key"],
            "enquiries": r["enquiries"],
            "failed": r["failed"],
            "message": f"High demand in {r['key']} — consider recruiting more supply",
        }
        for r in location_rows
        if r["enquiries"] >= 5 and (r["failed"] / r["enquiries"] if r["enquiries"] else 0) >= 0.25
    ][:5]

    top_vendors = []
    for vid, vs in vendor_stats.items():
        if not vid or vs["enquiries"] < 1:
            continue
        v = vendors.get(vid) or {}
        payload = v.get("payload") if isinstance(v.get("payload"), dict) else {}
        name = str(payload.get("businessName") or vid)[:80]
        rts = vs["response_seconds"]
        top_vendors.append(
            {
                "vendor_user_id": vid,
                "business_name": name,
                "enquiries": vs["enquiries"],
                "completed": vs["completed"],
                "conversion_rate": round(vs["completed"] / vs["enquiries"], 4) if vs["enquiries"] else 0.0,
                "avg_response_seconds": round(sum(rts) / len(rts), 1) if rts else None,
                "revenue_gbp": round(vs["revenue_gbp"], 2),
            },
        )
    top_vendors.sort(key=lambda x: (x["completed"], x["revenue_gbp"]), reverse=True)

    months = sorted(set(enquiries_by_month) | set(completed_by_month))
    profile_views = _count_profile_views(from_iso[:10], to_iso)

    return {
        "success": True,
        "from_date": from_iso[:10],
        "to_date": to_iso[:10] if "T" in to_iso else to_iso,
        "overview": {
            "vendors_total": vendors_total,
            "vendors_active": vendors_active,
            "enquiries": total_enquiries,
            "accepted": len(accepted),
            "paid": len(paid),
            "completed": len(completed),
            "enquiry_to_acceptance_rate": enquiry_to_accept,
            "acceptance_to_payment_rate": accept_to_pay,
            "overall_conversion_rate": overall_conversion,
            "avg_booking_value_gbp": avg_booking_value,
            "avg_vendor_response_seconds": avg_response,
            "avg_customer_rating": avg_rating,
            "review_count": review_count,
            "profile_views": profile_views,
            "unfulfilled": sum(failure_counts.values()),
        },
        "enquiries_by_month": [{"month": m, "count": enquiries_by_month.get(m, 0)} for m in months],
        "completed_by_month": [{"month": m, "count": completed_by_month.get(m, 0)} for m in months],
        "by_category": category_rows,
        "by_location": location_rows,
        "failure_reasons": [
            {"reason": k, "count": v} for k, v in sorted(failure_counts.items(), key=lambda x: -x[1])
        ],
        "top_vendors": top_vendors[:20],
        "recruitment_hints": {
            "categories": recruit_categories,
            "locations": recruit_locations,
        },
    }


def _count_profile_views(from_day: str, to_iso: str) -> int:
    if get_settings().local_auth_mode:
        return 0
    try:
        res = (
            get_client()
            .table("marketplace_events")
            .select("id", count="exact")
            .eq("event_name", "vendor_profile_viewed")
            .gte("created_at", from_day)
            .lte("created_at", to_iso)
            .execute()
        )
        return int(getattr(res, "count", 0) or 0)
    except Exception:
        return 0
