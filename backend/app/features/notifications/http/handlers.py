"""Notification feed handlers — shared by client and vendor routes."""

from __future__ import annotations

from typing import Literal

from app.contracts.notifications import NotificationFeedItem, NotificationFeedResponse
from app.core.db import get_db as get_client
from app.features.chat.service import count_unread_chat_total
from app.features.bookings.disputes import list_disputes_for_participant_user
from app.features.notifications.copy import format_booking_notification
from app.features.notifications.service import (
    count_unread_booking_notifications,
    list_booking_notifications,
    mark_all_booking_notifications_read,
    mark_booking_notification_read,
)
from app.features.realtime.sse import notify_user


def _event_names_for_bookings(booking_ids: list[str]) -> dict[str, str]:
    ids = [bid for bid in booking_ids if bid]
    if not ids:
        return {}
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("id,event_name")
            .in_("id", ids[:100])
            .execute()
        )
    except Exception:
        return {}
    out: dict[str, str] = {}
    for row in getattr(res, "data", None) or []:
        if not isinstance(row, dict):
            continue
        bid = str(row.get("id") or "")
        name = str(row.get("event_name") or "").strip()
        if bid and name:
            out[bid] = name
    return out


def unread_booking_count(uid: str) -> int:
    return count_unread_booking_notifications(uid)


def mark_all_booking_read(uid: str, *, notify: bool) -> dict[str, bool]:
    mark_all_booking_notifications_read(uid)
    if notify:
        notify_user(uid, "booking_notifications_changed")
    return {"success": True}


def mark_single_booking_read(uid: str, notification_id: str) -> dict[str, bool]:
    ok = mark_booking_notification_read(user_id=uid, notification_id=notification_id)
    return {"success": ok}


def build_notifications_feed(
    uid: str,
    *,
    portal: Literal["client", "vendor"],
) -> NotificationFeedResponse:
    booking_href_prefix = f"/{portal}/bookings"
    messages_href = f"/{portal}/messages"
    disputes_href = f"/{portal}/bookings?tab=disputes"

    items: list[NotificationFeedItem] = []

    booking_rows = list_booking_notifications(uid, limit=20)
    booking_ids = [str(row.get("booking_id") or "") for row in booking_rows if isinstance(row, dict)]
    event_names = _event_names_for_bookings(booking_ids)

    for row in booking_rows:
        if not isinstance(row, dict):
            continue
        nid = str(row.get("id") or "")
        bid = str(row.get("booking_id") or "")
        kind = str(row.get("kind") or "booking_update")
        body = row.get("body")
        created_at = row.get("created_at")
        read_at = row.get("read_at")
        title, display_body = format_booking_notification(
            kind=kind,
            portal=portal,
            event_name=event_names.get(bid),
            stored_body=str(body) if body is not None else None,
        )
        items.append(
            NotificationFeedItem(
                kind="booking_update",
                created_at=str(created_at) if created_at is not None else None,
                title=title,
                body=display_body,
                notification_id=nid or None,
                booking_id=bid or None,
                href=f"{booking_href_prefix}/{bid}" if bid else booking_href_prefix,
                unread=(read_at is None),
            ),
        )

    for d in list_disputes_for_participant_user(uid)[:10]:
        if not isinstance(d, dict):
            continue
        st = str(d.get("status") or "open")
        summary = str(d.get("summary") or "").strip()
        updated_at = d.get("updated_at") or d.get("created_at")
        items.append(
            NotificationFeedItem(
                kind="dispute_update",
                created_at=str(updated_at) if updated_at is not None else None,
                title=f"Dispute: {st.replace('_', ' ')}",
                body=summary[:2000] if summary else None,
                href=disputes_href,
                unread=None,
            ),
        )

    unread_chat = count_unread_chat_total(uid)
    if unread_chat > 0:
        items.append(
            NotificationFeedItem(
                kind="chat_unread_summary",
                created_at=None,
                title="Unread messages",
                body=f"You have {unread_chat} unread message{'s' if unread_chat != 1 else ''}.",
                href=messages_href,
                unread=True,
            ),
        )

    items = sorted(items, key=lambda it: it.created_at or "", reverse=True)[:25]
    return NotificationFeedResponse(items=items)
