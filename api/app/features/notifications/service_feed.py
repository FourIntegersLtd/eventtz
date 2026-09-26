"""In-app notifications for clients and vendors: the unread badge, marking notices read, the feed.

Every change tells the person's open tabs to refresh their badge once the
transaction commits.
"""

from __future__ import annotations

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


async def feed(session: AsyncSession, principal: Principal, *, portal: Portal) -> list[NotificationFeedItem]:
    """The caller's newest booking notices and disputes, plus a line for unread chat, newest first."""
    notices = await repository.latest_for_user(session, principal.id, limit=domain_feed.BOOKING_NOTICE_LIMIT)
    names = await repository_bookings.event_names(session, [notice.booking_id for notice in notices])
    items = [
        domain_feed.booking_item(notice, portal=portal, event_name=names.get(notice.booking_id))
        for notice in notices
    ]
    disputes = await repository_bookings.latest_disputes_for_party(
        session, principal.id, limit=domain_feed.DISPUTE_LIMIT
    )
    items.extend(domain_feed.dispute_item(dispute, portal=portal) for dispute in disputes)
    chat_item = domain_feed.chat_summary_item(await messaging.unread_count(session, principal), portal=portal)
    if chat_item is not None:
        items.append(chat_item)
    return [NotificationFeedItem.model_validate(item) for item in domain_feed.newest_first(items)]
