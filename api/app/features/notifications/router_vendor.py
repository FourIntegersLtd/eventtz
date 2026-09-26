"""Vendor routes: the booking-notice badge, marking notices read, and the dashboard feed."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.features.notifications import service_feed
from app.features.notifications.schemas import (
    BookingNotificationsUnreadResponse,
    NotificationFeedResponse,
    NotificationMarkReadResponse,
)

router = APIRouter(prefix="/vendor", tags=["vendor"])


@router.get(
    "/notifications/bookings/unread-count",
    response_model=BookingNotificationsUnreadResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_vendor_booking_notifications_unread_count(
    session: SessionDep, vendor: CurrentVendor
) -> BookingNotificationsUnreadResponse:
    """How many booking notices the vendor has not read."""
    return BookingNotificationsUnreadResponse(unread_count=await service_feed.unread_count(session, vendor))


@router.post(
    "/notifications/bookings/mark-all-read",
    response_model=NotificationMarkReadResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def post_vendor_booking_notifications_mark_all_read(
    session: SessionDep, vendor: CurrentVendor
) -> NotificationMarkReadResponse:
    """Mark every booking notice read."""
    await service_feed.mark_all_read(session, vendor)
    return NotificationMarkReadResponse(success=True)


@router.post(
    "/notifications/bookings/{notification_id}/mark-read",
    response_model=NotificationMarkReadResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def post_vendor_booking_notification_mark_read(
    session: SessionDep, vendor: CurrentVendor, notification_id: str
) -> NotificationMarkReadResponse:
    """Mark one notice read; `success` is false when it is not one of the vendor's."""
    return NotificationMarkReadResponse(
        success=await service_feed.mark_read(session, vendor, notification_id)
    )


@router.get(
    "/notifications/feed",
    response_model=NotificationFeedResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_vendor_notifications_feed(
    session: SessionDep, vendor: CurrentVendor
) -> NotificationFeedResponse:
    """The vendor's dashboard feed, newest first."""
    return NotificationFeedResponse(items=await service_feed.feed(session, vendor, portal="vendor"))
