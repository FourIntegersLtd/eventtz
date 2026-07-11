"""In-app booking notifications for clients (email can be layered on later)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.realtime.sse import notify_user

logger = get_logger(__name__)

BookingNotifyKind = Literal[
    "booking_accepted",
    "booking_completed",
    "booking_declined_by_vendor",
    "booking_request_received",
    "booking_cancelled_by_client",
    "booking_cancelled_by_vendor",
    "booking_pricing_updated",
    "vendor_quote_received",
    "vendor_quote_accepted",
    "vendor_quote_declined",
    "vendor_quote_withdrawn",
    "payment_received",
    "vendor_payment_received",
    "vendor_payout_released",
    "payment_refunded",
    "completion_confirmed_awaiting_other_party",
]


def insert_booking_notification_if_absent(
    *,
    user_id: str,
    booking_id: str,
    kind: BookingNotifyKind,
) -> None:
    """Idempotent: one row per (booking_id, kind). Skips in local_auth_mode."""
    if get_settings().local_auth_mode:
        return
    try:
        client = get_client()
        existing = (
            client.table("booking_notifications")
            .select("id")
            .eq("booking_id", booking_id)
            .eq("kind", kind)
            .limit(1)
            .execute()
        )
        rows = getattr(existing, "data", None) or []
        if rows:
            return
        client.table("booking_notifications").insert(
            {"user_id": user_id, "booking_id": booking_id, "kind": kind},
        ).execute()
        logger.info(
            "booking notification created user=%s booking=%s kind=%s",
            user_id,
            booking_id,
            kind,
        )
        notify_user(user_id, "booking_notifications_changed")
    except Exception:
        logger.exception(
            "insert_booking_notification failed user=%s booking=%s kind=%s",
            user_id,
            booking_id,
            kind,
        )


def upsert_booking_notification(
    *,
    user_id: str,
    booking_id: str,
    kind: BookingNotifyKind,
    body: str | None = None,
) -> None:
    """
    Replace the notification row for (booking_id, kind): new body and unread state.
    """
    if get_settings().local_auth_mode:
        return
    try:
        client = get_client()
        client.table("booking_notifications").delete().eq("booking_id", booking_id).eq(
            "kind",
            kind,
        ).execute()
        client.table("booking_notifications").insert(
            {"user_id": user_id, "booking_id": booking_id, "kind": kind, "body": body},
        ).execute()
        logger.info(
            "booking notification upserted user=%s booking=%s kind=%s",
            user_id,
            booking_id,
            kind,
        )
        notify_user(user_id, "booking_notifications_changed")
    except Exception:
        logger.exception(
            "upsert_booking_notification failed user=%s booking=%s kind=%s",
            user_id,
            booking_id,
            kind,
        )


def count_unread_booking_notifications(user_id: str) -> int:
    if get_settings().local_auth_mode:
        return 0
    try:
        res = (
            get_client()
            .table("booking_notifications")
            .select("id")
            .eq("user_id", user_id)
            .is_("read_at", "null")
            .execute()
        )
        data = getattr(res, "data", None) or []
        return len(data) if isinstance(data, list) else 0
    except Exception:
        logger.exception("count_unread_booking_notifications failed user=%s", user_id)
        return 0


def mark_all_booking_notifications_read(user_id: str) -> None:
    if get_settings().local_auth_mode:
        return
    now = datetime.now(timezone.utc).isoformat()
    try:
        get_client().table("booking_notifications").update({"read_at": now}).eq(
            "user_id",
            user_id,
        ).is_("read_at", "null").execute()
        notify_user(user_id, "booking_notifications_changed")
    except Exception:
        logger.exception("mark_all_booking_notifications_read failed user=%s", user_id)


def mark_booking_notification_read(*, user_id: str, notification_id: str) -> bool:
    """Mark a single booking_notifications row read for this user."""
    if get_settings().local_auth_mode:
        return False
    nid = (notification_id or "").strip()
    if not nid:
        return False
    now = datetime.now(timezone.utc).isoformat()
    try:
        res = (
            get_client()
            .table("booking_notifications")
            .update({"read_at": now})
            .eq("id", nid)
            .eq("user_id", user_id)
            .execute()
        )
        data = getattr(res, "data", None) or []
        ok = bool(data)
        if ok:
            notify_user(user_id, "booking_notifications_changed")
        return ok
    except Exception:
        logger.exception(
            "mark_booking_notification_read failed user=%s notification=%s",
            user_id,
            nid,
        )
        return False


def list_booking_notifications(
    user_id: str,
    *,
    limit: int = 30,
) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    lim = max(1, min(limit, 100))
    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("booking_notifications")
                .select("id,booking_id,kind,body,read_at,created_at")
                .eq("user_id", user_id),
                column="created_at",
            )
            .limit(lim)
            .execute()
        )
        out: list[dict[str, Any]] = []
        for row in getattr(res, "data", None) or []:
            if isinstance(row, dict):
                out.append(row)
        return out
    except Exception:
        logger.exception("list_booking_notifications failed user=%s", user_id)
        return []
