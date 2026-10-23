"""Portal routes: the booking-notice badge, marking notices read, and the dashboard feed.

The client and vendor portals get identical routes under their own prefix; only the account that
may call them differs. Built by `portal_router` so a fix lands once, not twice. This module has
no `from __future__ import annotations`: FastAPI reads the role's dependency from the closure,
and a string annotation could not resolve it.
"""

from collections.abc import Callable
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Query

from app.core.auth import ROLE_ERRORS, Principal, require_client, require_vendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import PageDep
from app.features.notifications import service_feed
from app.features.notifications.schemas import (
    BookingNotificationsUnreadResponse,
    NotificationFeedResponse,
    NotificationMarkReadResponse,
)
from app.features.notifications.service_feed import FeedTopic, ReadState


def portal_router(role: Literal["client", "vendor"], require_role: Callable[..., Principal]) -> APIRouter:
    """The notification routes for `role`, guarded by `require_role`."""
    router = APIRouter(prefix=f"/{role}", tags=[role])
    account = Annotated[Principal, Depends(require_role)]

    @router.get(
        "/notifications/bookings/unread-count",
        name=f"get_{role}_booking_notifications_unread_count",
        response_model=BookingNotificationsUnreadResponse,
        responses=error_responses(*ROLE_ERRORS),
    )
    async def get_unread_count(session: SessionDep, user: account) -> BookingNotificationsUnreadResponse:
        """How many booking notices the caller has not read."""
        return BookingNotificationsUnreadResponse(unread_count=await service_feed.unread_count(session, user))

    @router.post(
        "/notifications/bookings/mark-all-read",
        name=f"post_{role}_booking_notifications_mark_all_read",
        response_model=NotificationMarkReadResponse,
        responses=error_responses(*ROLE_ERRORS),
    )
    async def post_mark_all_read(session: SessionDep, user: account) -> NotificationMarkReadResponse:
        """Mark every booking notice read."""
        await service_feed.mark_all_read(session, user)
        return NotificationMarkReadResponse(success=True)

    @router.post(
        "/notifications/bookings/{notification_id}/mark-read",
        name=f"post_{role}_booking_notification_mark_read",
        response_model=NotificationMarkReadResponse,
        responses=error_responses(*ROLE_ERRORS),
    )
    async def post_mark_read(
        session: SessionDep, user: account, notification_id: str
    ) -> NotificationMarkReadResponse:
        """Mark one notice read; `success` is false when it is not one of the caller's."""
        return NotificationMarkReadResponse(
            success=await service_feed.mark_read(session, user, notification_id)
        )

    @router.get(
        "/notifications/feed",
        name=f"get_{role}_notifications_feed",
        response_model=NotificationFeedResponse,
        responses=error_responses(*ROLE_ERRORS),
    )
    async def get_feed(
        session: SessionDep,
        user: account,
        page: PageDep,
        read_state: str = Query("all", pattern="^(all|unread)$"),
        topic: str = Query("all", pattern="^(all|bookings|payments|messages)$"),
    ) -> NotificationFeedResponse:
        """The caller's dashboard feed, newest first."""
        items, total = await service_feed.feed_page(
            session,
            user,
            portal=role,
            offset=page.offset,
            limit=page.limit,
            read_state=cast(ReadState, read_state),
            topic=cast(FeedTopic, topic),
        )
        return NotificationFeedResponse(items=items, total=total, offset=page.offset, limit=page.limit)

    return router


client_router = portal_router("client", require_client)
vendor_router = portal_router("vendor", require_vendor)
