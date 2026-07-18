"""Public-safe vendor performance metrics for explore / browse surfaces.

Revenue and pending counts stay private. These fields are safe to show clients:
completed bookings, average response time, conversion rate.
"""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger

logger = get_logger(__name__)

_EMPTY: dict[str, Any] = {
    "completed_bookings": 0,
    "avg_response_seconds": None,
    "conversion_rate": None,
}


def empty_public_vendor_metrics() -> dict[str, Any]:
    return dict(_EMPTY)


def format_usual_reply_seconds(seconds: Any) -> str | None:
    """Short duration phrase, e.g. 'within 2 hours'."""
    if seconds is None:
        return None
    try:
        s = float(seconds)
    except (TypeError, ValueError):
        return None
    if s != s:  # NaN
        return None
    if s < 60:
        n = max(1, int(round(s)))
        unit = "second" if n == 1 else "seconds"
        return f"within {n} {unit}"
    if s < 3600:
        n = max(1, int(round(s / 60)))
        unit = "minute" if n == 1 else "minutes"
        return f"within {n} {unit}"
    if s < 86400:
        n = max(1, int(round(s / 3600)))
        unit = "hour" if n == 1 else "hours"
        return f"within {n} {unit}"
    n = max(1, int(round(s / 86400)))
    unit = "day" if n == 1 else "days"
    return f"within {n} {unit}"


def usual_reply_sentence(seconds: Any) -> str:
    within = format_usual_reply_seconds(seconds)
    if within:
        return f"Usually replies {within}."
    return "Most vendors reply within a day."


def _metrics_from_booking_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate public metrics from booking_requests rows for one vendor."""
    enquiries = [r for r in rows if str(r.get("initiator") or "") == "client"]
    completed = [
        r
        for r in rows
        if r.get("status") == "completed" or r.get("completed_at")
    ]
    rts = [
        int(r["vendor_response_time_seconds"])
        for r in rows
        if r.get("vendor_response_time_seconds") is not None
    ]
    completed_n = len(completed)
    enquiry_n = len(enquiries)
    return {
        "completed_bookings": completed_n,
        "avg_response_seconds": round(sum(rts) / len(rts), 1) if rts else None,
        "conversion_rate": round(completed_n / enquiry_n, 4) if enquiry_n else None,
    }


def get_public_metrics_for_vendors(vendor_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Batch: { vendor_user_id: metrics dict }."""
    if get_settings().local_auth_mode or not vendor_ids:
        return {}
    ids = [str(v) for v in vendor_ids if v][:500]
    if not ids:
        return {}
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select(
                "vendor_user_id,status,initiator,completed_at,vendor_response_time_seconds",
            )
            .in_("vendor_user_id", ids)
            .limit(5000)
            .execute()
        )
        rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("public_vendor_metrics: load failed")
        return {vid: empty_public_vendor_metrics() for vid in ids}

    by_vendor: dict[str, list[dict[str, Any]]] = {vid: [] for vid in ids}
    for r in rows:
        vid = str(r.get("vendor_user_id") or "")
        if vid in by_vendor:
            by_vendor[vid].append(r)

    return {vid: _metrics_from_booking_rows(rs) for vid, rs in by_vendor.items()}


def merge_public_metrics_into_vendor_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add completed_bookings, avg_response_seconds, conversion_rate onto each row."""
    if not rows:
        return rows
    ids = [str(r.get("user_id") or "") for r in rows if isinstance(r, dict) and r.get("user_id")]
    stats = get_public_metrics_for_vendors(ids)
    for r in rows:
        if not isinstance(r, dict):
            continue
        uid = str(r.get("user_id") or "")
        m = stats.get(uid) or empty_public_vendor_metrics()
        r["completed_bookings"] = int(m.get("completed_bookings") or 0)
        r["avg_response_seconds"] = m.get("avg_response_seconds")
        r["conversion_rate"] = m.get("conversion_rate")
    return rows
