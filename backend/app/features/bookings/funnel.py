"""Booking funnel timestamps and first-response tracking for marketplace analytics."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.db import get_db as get_client
from app.core.logging import get_logger

logger = get_logger(__name__)

FAILURE_VENDOR_UNAVAILABLE = "VENDOR_UNAVAILABLE"
FAILURE_CUSTOMER_CANCELLED = "CUSTOMER_CANCELLED"
FAILURE_VENDOR_NO_RESPONSE = "VENDOR_NO_RESPONSE"
FAILURE_PAYMENT_FAILED = "PAYMENT_FAILED"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_ts(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def response_time_seconds(created_at: Any, response_at: datetime | None = None) -> int | None:
    created = _parse_ts(created_at)
    resp = response_at or datetime.now(timezone.utc)
    if created is None:
        return None
    secs = int((resp - created).total_seconds())
    return max(0, secs)


def mark_vendor_first_response(
    booking_id: str,
    *,
    created_at: Any = None,
    at: datetime | None = None,
) -> None:
    """Set vendor_first_response_at once (never overwrite)."""
    if not booking_id:
        return
    try:
        db = get_client()
        now = at or datetime.now(timezone.utc)
        row_created = created_at
        if row_created is None:
            res = (
                db.table("booking_requests")
                .select("created_at,vendor_first_response_at")
                .eq("id", booking_id)
                .limit(1)
                .execute()
            )
            rows = getattr(res, "data", None) or []
            if not rows or not isinstance(rows[0], dict):
                return
            if rows[0].get("vendor_first_response_at"):
                return
            row_created = rows[0].get("created_at")
        secs = response_time_seconds(row_created, now)
        patch: dict[str, Any] = {"vendor_first_response_at": now.isoformat()}
        if secs is not None:
            patch["vendor_response_time_seconds"] = secs
        db.table("booking_requests").update(patch).eq("id", booking_id).is_(
            "vendor_first_response_at",
            "null",
        ).execute()
    except Exception:
        logger.exception("funnel: mark_vendor_first_response failed booking=%s", booking_id)


def patch_booking_funnel(booking_id: str, fields: dict[str, Any]) -> None:
    """Best-effort update of funnel columns (ignores empty booking id)."""
    if not booking_id or not fields:
        return
    try:
        get_client().table("booking_requests").update(fields).eq("id", booking_id).execute()
    except Exception:
        logger.exception("funnel: patch failed booking=%s fields=%s", booking_id, list(fields))


def accept_funnel_fields(*, created_at: Any = None) -> dict[str, Any]:
    now = _now_iso()
    out: dict[str, Any] = {"accepted_at": now}
    secs = response_time_seconds(created_at)
    # First response may already be set; callers merge carefully via SQL is-null updates.
    out["_first_response_at"] = now
    out["_first_response_seconds"] = secs
    return out


def decline_funnel_fields(*, created_at: Any = None) -> dict[str, Any]:
    now = _now_iso()
    return {
        "declined_at": now,
        "failure_reason": FAILURE_VENDOR_UNAVAILABLE,
        "failure_noted_at": now,
        "_first_response_at": now,
        "_first_response_seconds": response_time_seconds(created_at),
    }


def apply_accept_update(booking_id: str, *, created_at: Any = None) -> dict[str, Any]:
    """Build update dict for accept; also sets first response if empty via separate call."""
    now = _now_iso()
    mark_vendor_first_response(booking_id, created_at=created_at)
    return {
        "status": "accepted",
        "accepted_at": now,
        "failure_reason": None,
        "failure_noted_at": None,
    }


def apply_decline_update(booking_id: str, *, created_at: Any = None) -> dict[str, Any]:
    now = _now_iso()
    mark_vendor_first_response(booking_id, created_at=created_at)
    return {
        "status": "declined",
        "declined_at": now,
        "failure_reason": FAILURE_VENDOR_UNAVAILABLE,
        "failure_noted_at": now,
    }


def mark_vendor_notified(booking_id: str) -> None:
    patch_booking_funnel(booking_id, {"vendor_notified_at": _now_iso()})


def mark_payment_requested(booking_id: str) -> None:
    """Set payment_requested_at once when checkout starts."""
    if not booking_id:
        return
    try:
        get_client().table("booking_requests").update(
            {"payment_requested_at": _now_iso()},
        ).eq("id", booking_id).is_("payment_requested_at", "null").execute()
    except Exception:
        logger.exception("funnel: payment_requested failed booking=%s", booking_id)


def mark_completed(booking_id: str) -> None:
    if not booking_id:
        return
    try:
        get_client().table("booking_requests").update(
            {"completed_at": _now_iso()},
        ).eq("id", booking_id).is_("completed_at", "null").execute()
    except Exception:
        logger.exception("funnel: completed_at failed booking=%s", booking_id)


def mark_refunded(booking_id: str) -> None:
    if not booking_id:
        return
    try:
        get_client().table("booking_requests").update(
            {"refunded_at": _now_iso()},
        ).eq("id", booking_id).is_("refunded_at", "null").execute()
    except Exception:
        logger.exception("funnel: refunded_at failed booking=%s", booking_id)


def mark_customer_cancelled_failure(booking_id: str) -> None:
    if not booking_id:
        return
    try:
        now = _now_iso()
        get_client().table("booking_requests").update(
            {
                "failure_reason": FAILURE_CUSTOMER_CANCELLED,
                "failure_noted_at": now,
            },
        ).eq("id", booking_id).is_("failure_reason", "null").execute()
    except Exception:
        logger.exception("funnel: customer cancel failure failed booking=%s", booking_id)


def mark_stale_enquiries_no_response(*, sla_hours: int) -> int:
    """Mark pending client enquiries past SLA with VENDOR_NO_RESPONSE (analytics only).

    Why soft-mark: expired response is a funnel signal for admin/vendor analytics;
    do not auto-decline — the vendor may still reply and the client may still book.
    """
    if sla_hours <= 0:
        return 0
    try:
        db = get_client()
        cutoff = datetime.now(timezone.utc).timestamp() - (sla_hours * 3600)
        cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
        res = (
            db.table("booking_requests")
            .select("id")
            .eq("status", "pending")
            .eq("initiator", "client")
            .is_("failure_reason", "null")
            .lt("created_at", cutoff_iso)
            .limit(500)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        now = _now_iso()
        count = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            bid = str(row.get("id") or "")
            if not bid:
                continue
            upd = (
                db.table("booking_requests")
                .update(
                    {
                        "failure_reason": FAILURE_VENDOR_NO_RESPONSE,
                        "failure_noted_at": now,
                    },
                )
                .eq("id", bid)
                .eq("status", "pending")
                .is_("failure_reason", "null")
                .execute()
            )
            if getattr(upd, "data", None):
                count += 1
        return count
    except Exception:
        logger.exception("funnel: mark_stale_enquiries_no_response failed")
        return 0
