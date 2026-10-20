"""In-app notifications for clients and vendors: the unread badge, marking notices read, the feed.

Every change tells the person's open tabs to refresh their badge once the
transaction commits.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.events import publish_after_commit, user_topic
from app.features.messaging import service_chat as messaging
from app.features.notifications import domain_feed, repository, repository_bookings
from app.features.notifications.domain_booking_copy import Portal
from app.features.notifications.schemas import NotificationFeedItem

# What open tabs listen for to refresh the booking-notice badge.
BOOKING_NOTIFICATIONS_CHANGED = "booking_notifications_changed"


async def unread_count(session: AsyncSession, principal: Principal) -> int:
    """How many booking notices the caller has not read."""
    return await repository.count_unread(session, principal.id)


async def mark_all_read(session: AsyncSession, principal: Principal) -> None:
    """Mark every booking notice of the caller read."""
    await repository.mark_all_read(session, principal.id)
    publish_after_commit(session, user_topic(principal.id), BOOKING_NOTIFICATIONS_CHANGED)


async def mark_read(session: AsyncSession, principal: Principal, notification_id: str) -> bool:
    """Mark one of the caller's notices read. False (not an error) for a blank, unknown or other's id."""
    marked = await repository.mark_read(
        session, user_id=principal.id, notification_id=notification_id.strip()
    )
    if marked:
        publish_after_commit(session, user_topic(principal.id), BOOKING_NOTIFICATIONS_CHANGED)
    return marked


# Caps when assembling the full feed before slicing a page.
_FEED_NOTICE_CAP = 500
_FEED_DISPUTE_CAP = 200


async def _assembled_feed_items(
    session: AsyncSession, principal: Principal, *, portal: Portal
) -> list[NotificationFeedItem]:
    """Every feed line (notices, disputes, optional chat summary), newest first."""
    notices = await repository.latest_for_user(session, principal.id, limit=_FEED_NOTICE_CAP)
    names = await repository_bookings.event_names(session, [notice.booking_id for notice in notices])
    items = [
        domain_feed.booking_item(notice, portal=portal, event_name=names.get(notice.booking_id))
        for notice in notices
    ]
    disputes = await repository_bookings.latest_disputes_for_party(
        session, principal.id, limit=_FEED_DISPUTE_CAP
    )
    items.extend(domain_feed.dispute_item(dispute, portal=portal) for dispute in disputes)
    chat_item = domain_feed.chat_summary_item(await messaging.unread_count(session, principal), portal=portal)
    if chat_item is not None:
        items.append(chat_item)
    return [NotificationFeedItem.model_validate(item) for item in domain_feed.newest_first(items)]


async def feed(session: AsyncSession, principal: Principal, *, portal: Portal) -> list[NotificationFeedItem]:
    """The caller's newest booking notices and disputes, plus a line for unread chat, newest first."""
    items, _total = await feed_page(session, principal, portal=portal, offset=0, limit=domain_feed.FEED_LIMIT)
    return items


ReadState = Literal["all", "unread"]
FeedTopic = Literal["all", "bookings", "payments", "messages"]


def _is_payment_item(item: NotificationFeedItem) -> bool:
    """True when the copy looks like a payment or payout notice."""
    text = f"{item.title} {item.body or ''}".lower()
    return "payout" in text or "payment" in text or "paid" in text


def _matches_topic(item: NotificationFeedItem, topic: FeedTopic) -> bool:
    """Whether a feed line belongs to the bookings, payments or messages topic."""
    if topic == "all":
        return True
    if topic == "messages":
        return item.kind == "chat_unread_summary"
    if topic == "payments":
        return _is_payment_item(item)
    return item.kind in ("booking_update", "dispute_update")


def _filter_feed_items(
    items: list[NotificationFeedItem], *, read_state: ReadState, topic: FeedTopic
) -> list[NotificationFeedItem]:
    """Apply unread and topic filters before pagination."""
    filtered = items
    if read_state == "unread":
        filtered = [item for item in filtered if item.unread is True]
    if topic != "all":
        filtered = [item for item in filtered if _matches_topic(item, topic)]
    return filtered


async def feed_page(
    session: AsyncSession,
    principal: Principal,
    *,
    portal: Portal,
    offset: int,
    limit: int,
    read_state: ReadState = "all",
    topic: FeedTopic = "all",
) -> tuple[list[NotificationFeedItem], int]:
    """One page of the caller's feed plus total item count."""
    assembled = _filter_feed_items(
        await _assembled_feed_items(session, principal, portal=portal),
        read_state=read_state,
        topic=topic,
    )
    total = len(assembled)
    return assembled[offset : offset + limit], total
