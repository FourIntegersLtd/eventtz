"""The notifications feed on a client or vendor dashboard: booking notices, disputes and unread chat.

Pure: the service hands in rows and counts, these functions shape feed items
(plain dicts in the `NotificationFeedItem` shape) and order them.
"""

from __future__ import annotations

from typing import Any

from app.features.notifications.domain_booking_copy import Portal, format_booking_notification
from app.features.notifications.rows import DisputeNoticeRow, StoredNotificationRow

# How many booking notices, and disputes, the feed reads, and how many items it shows.
BOOKING_NOTICE_LIMIT = 20
DISPUTE_LIMIT = 10
FEED_LIMIT = 25
# The longest dispute summary the feed shows.
DISPUTE_SUMMARY_LIMIT = 2000


def booking_item(notice: StoredNotificationRow, *, portal: Portal, event_name: str | None) -> dict[str, Any]:
    """A booking notice as a feed item, linking to the booking (or the bookings list without one)."""
    title, body = format_booking_notification(
        kind=notice.kind or "booking_update", portal=portal, event_name=event_name, stored_body=notice.body
    )
    bookings_href = f"/{portal}/bookings"
    return {
        "kind": "booking_update",
        "created_at": notice.created_at,
        "title": title,
        "body": body,
        "notification_id": notice.id or None,
        "booking_id": notice.booking_id or None,
        "href": f"{bookings_href}/{notice.booking_id}" if notice.booking_id else bookings_href,
        "unread": notice.read_at is None,
    }


def dispute_item(dispute: DisputeNoticeRow, *, portal: Portal) -> dict[str, Any]:
    """A dispute as a feed item, titled by its status and linking to the disputes tab."""
    status = dispute.status or "open"
    summary = (dispute.summary or "").strip()
    return {
        "kind": "dispute_update",
        "created_at": dispute.updated_at or dispute.created_at,
        "title": f"Dispute: {status.replace('_', ' ')}",
        "body": summary[:DISPUTE_SUMMARY_LIMIT] if summary else None,
        "href": f"/{portal}/bookings?tab=disputes",
        "unread": None,
    }


def chat_summary_item(unread_messages: int, *, portal: Portal) -> dict[str, Any] | None:
    """One "Unread messages" item when chat messages are waiting; None when there are none."""
    if unread_messages <= 0:
        return None
    plural = "s" if unread_messages != 1 else ""
    return {
        "kind": "chat_unread_summary",
        "created_at": None,
        "title": "Unread messages",
        "body": f"You have {unread_messages} unread message{plural}.",
        "href": f"/{portal}/messages",
        "unread": True,
    }


def newest_first(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The feed's first `FEED_LIMIT` items, newest first. Undated items (the chat summary) sort last.

    The sort is stable and compares ISO text, as the baseline did.
    """
    return sorted(items, key=lambda item: item["created_at"] or "", reverse=True)[:FEED_LIMIT]
