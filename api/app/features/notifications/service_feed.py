"""In-app notifications for clients and vendors: the unread badge, marking notices read, the feed.

Every change tells the person's open tabs to refresh their badge once the
transaction commits.
"""

from __future__ import annotations

from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.events import publish_after_commit, user_topic
from app.features.messaging import service_chat as messaging
from app.features.notifications import domain_feed, repository, repository_bookings
from app.features.notifications.domain_booking_copy import Portal
from app.features.notifications.rows import DisputeNoticeRow, StoredNotificationRow
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


ReadState = Literal["all", "unread"]
FeedTopic = domain_feed.FeedTopic


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
    """One page of the caller's feed plus the exact count of items the filters keep.

    Notices and disputes are filtered, merged newest first and paged in the database.
    The "Unread messages" summary is not a stored row: when it applies it is the
    feed's last item (undated items sort last, as in the baseline), counted in the
    total and shown on the page that reaches that position.
    """
    scope = domain_feed.topic_scope(topic)
    lines, dated_total = await repository_bookings.feed_lines(
        session,
        principal.id,
        scope=scope,
        unread_only=read_state == "unread",
        offset=offset,
        limit=limit,
    )
    notices = {
        line.id: StoredNotificationRow.model_validate(line.model_dump())
        for line in lines
        if line.source == "notice"
    }
    names = await repository_bookings.event_names(session, [notice.booking_id for notice in notices.values()])
    items: list[dict[str, Any]] = []
    for line in lines:
        if line.source == "notice":
            notice = notices[line.id]
            items.append(
                domain_feed.booking_item(notice, portal=portal, event_name=names.get(notice.booking_id))
            )
        else:
            items.append(
                domain_feed.dispute_item(DisputeNoticeRow.model_validate(line.model_dump()), portal=portal)
            )
    total = dated_total
    if scope.chat_summary:
        chat_item = domain_feed.chat_summary_item(
            await messaging.unread_count(session, principal), portal=portal
        )
        if chat_item is not None:
            if offset <= dated_total < offset + limit:
                items.append(chat_item)
            total += 1
    return [NotificationFeedItem.model_validate(item) for item in items], total
