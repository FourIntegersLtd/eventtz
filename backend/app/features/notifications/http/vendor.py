"""Vendor: booking notification counts, mark-read, and dashboard updates feed."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.features.auth.http.guards import require_vendor
from app.features.notifications.http import handlers as nh
from app.contracts.booking import BookingNotificationsUnreadResponse
from app.contracts.notifications import NotificationFeedResponse

router = APIRouter(prefix="/vendor", tags=["vendor"])


@router.get(
    "/notifications/bookings/unread-count",
    response_model=BookingNotificationsUnreadResponse,
)
def get_unread_booking_notifications_count(
    request: Request,
    response: Response,
) -> BookingNotificationsUnreadResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    return BookingNotificationsUnreadResponse(unread_count=nh.unread_booking_count(uid))


@router.post("/notifications/bookings/mark-all-read")
def post_mark_booking_notifications_read(
    request: Request,
    response: Response,
) -> dict[str, bool]:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    return nh.mark_all_booking_read(uid, notify=False)


@router.post("/notifications/bookings/{notification_id}/mark-read")
def post_mark_single_booking_notification_read(
    request: Request,
    response: Response,
    notification_id: str,
) -> dict[str, bool]:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    return nh.mark_single_booking_read(uid, notification_id)


@router.get("/notifications/feed", response_model=NotificationFeedResponse)
def get_vendor_notifications_feed(request: Request, response: Response) -> NotificationFeedResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    return nh.build_notifications_feed(uid, portal="vendor")
