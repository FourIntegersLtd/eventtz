"""The notifications feed on a client or vendor dashboard: booking notices, disputes and unread chat.

Pure: the service hands in rows and counts, these functions shape feed items
(plain dicts in the `NotificationFeedItem` shape) and say what each topic filter reads.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.features.notifications.domain_booking_copy import Portal, format_booking_notification
from app.features.notifications.rows import DisputeNoticeRow, StoredNotificationRow

# How many items a feed page shows when the caller does not say.
FEED_LIMIT = 25
# The longest dispute summary the feed shows.
DISPUTE_SUMMARY_LIMIT = 2000

NoticeTopic = Literal["bookings", "payments"]

_PAYMENT_KINDS = (
    "payment_received",
    "vendor_payment_received",
    "vendor_payout_released",
    "payment_refunded",
    "payout_held_connect_incomplete",
    "booking_payment_expired",
    "vendor_booking_payment_expired",
    "pay_to_confirm",
    "deposit_refunded",
    "vendor_upfront_released",
    "vendor_final_released",
)
_BOOKING_KINDS = (
    "booking_accepted",
    "booking_completed",
    "booking_declined_by_vendor",
    "booking_request_received",
    "booking_request_sent",
    "booking_cancelled_by_client",
    "booking_cancelled_by_vendor",
    "booking_cancelled_by_eventtz",
    "booking_pricing_updated",
    "client_confirmed_updated_price",
    "client_declined_updated_price",
    "vendor_quote_received",
    "vendor_quote_accepted",
    "vendor_quote_declined",
    "vendor_quote_withdrawn",
    "completion_confirmed_awaiting_other_party",
    "completion_reminder",
    "vendor_completion_reminder",
    "enquiry_reminder_1h",
    "enquiry_reminder_6h",
    "enquiry_reminder_24h",
    "client_vendor_no_response",
    "event_tomorrow",
    "vendor_event_tomorrow",
    "date_change_requested",
    "date_change_accepted",
    "date_change_declined",
    "date_change_withdrawn",
    "delivery_confirmed",
    "deposit_claim_opened",
    "deposit_claim_resolved",
    "vendor_deposit_claim_resolved",
    "awaiting_delivery",
)
# Which feed topic each stored notice kind belongs to. Decided by kind, never by the
# wording of the copy. Money moving (a payment, refund, payout or hold) is "payments"; the
# opening and the outcome of a deposit claim are "bookings" (a claim is a dispute-like
# booking event), but `deposit_refunded`, the refund itself, is "payments". The "bookings"
# topic shows every notice, so a payments kind is listed there too.
# A kind in migration 0007's check constraint must appear here
# (`tests/unit/test_notifications_feed.py` fails otherwise).
NOTICE_KIND_TOPICS: dict[str, NoticeTopic] = {
    **{kind: "payments" for kind in _PAYMENT_KINDS},
    **{kind: "bookings" for kind in _BOOKING_KINDS},
}
FeedTopic = Literal["all", "bookings", "payments", "messages"]


@dataclass(frozen=True)
class TopicScope:
    """Which feed sources a topic reads, and which notice kinds it keeps.

    `kinds_in` is None when the topic does not narrow notices by kind.
    """

    notices: bool
    disputes: bool
    chat_summary: bool
    kinds_in: tuple[str, ...] | None = None


# Every stored kind of the payments topic, for the database filter.
PAYMENT_NOTICE_KINDS: tuple[str, ...] = tuple(
    sorted(kind for kind, topic in NOTICE_KIND_TOPICS.items() if topic == "payments")
)


def topic_scope(topic: FeedTopic) -> TopicScope:
    """What a topic filter reads.

    Payments is the payment kinds only. Bookings is every notice and dispute (payment
    notices are also booking news, as in the baseline: the two tabs overlap). Messages
    is the unread-chat summary alone.
    """
    if topic == "payments":
        return TopicScope(notices=True, disputes=False, chat_summary=False, kinds_in=PAYMENT_NOTICE_KINDS)
    if topic == "bookings":
        return TopicScope(notices=True, disputes=True, chat_summary=False)
    if topic == "messages":
        return TopicScope(notices=False, disputes=False, chat_summary=True)
    return TopicScope(notices=True, disputes=True, chat_summary=True)


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
