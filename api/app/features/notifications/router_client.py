"""Client routes: the booking-notice badge, marking notices read, and the dashboard feed."""

from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentClient
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.features.notifications import service_feed
from app.features.notifications.schemas import (
    BookingNotificationsUnreadResponse,
    NotificationFeedResponse,
    NotificationMarkReadResponse,
)
from app.features.notifications.service_feed import FeedTopic, ReadState

router = APIRouter(prefix="/client", tags=["client"])


@router.get(
    "/notifications/bookings/unread-count",
    response_model=BookingNotificationsUnreadResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_client_booking_notifications_unread_count(
    session: SessionDep, client: CurrentClient
) -> BookingNotificationsUnreadResponse:
    """How many booking notices the client has not read."""
    return BookingNotificationsUnreadResponse(unread_count=await service_feed.unread_count(session, client))


@router.post(
    "/notifications/bookings/mark-all-read",
    response_model=NotificationMarkReadResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def post_client_booking_notifications_mark_all_read(
    session: SessionDep, client: CurrentClient
) -> NotificationMarkReadResponse:
    """Mark every booking notice read."""
    await service_feed.mark_all_read(session, client)
    return NotificationMarkReadResponse(success=True)


@router.post(
    "/notifications/bookings/{notification_id}/mark-read",
    response_model=NotificationMarkReadResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def post_client_booking_notification_mark_read(
    session: SessionDep, client: CurrentClient, notification_id: str
) -> NotificationMarkReadResponse:
    """Mark one notice read; `success` is false when it is not one of the client's."""
    return NotificationMarkReadResponse(
        success=await service_feed.mark_read(session, client, notification_id)
    )


@router.get(
    "/notifications/feed",
    response_model=NotificationFeedResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_client_notifications_feed(
    session: SessionDep,
    client: CurrentClient,
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=200),
    read_state: str = Query("all", pattern="^(all|unread)$"),
    topic: str = Query("all", pattern="^(all|bookings|payments|messages)$"),
) -> NotificationFeedResponse:
    """The client's dashboard feed, newest first."""
    items, total = await service_feed.feed_page(
        session,
        client,
        portal="client",
        offset=offset,
        limit=limit,
        read_state=cast(ReadState, read_state),
        topic=cast(FeedTopic, topic),
    )
    return NotificationFeedResponse(items=items, total=total, offset=offset, limit=limit)
