"""Client: booking notification counts, mark-read, and dashboard updates feed."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.features.auth.http.guards import require_client
from app.features.notifications.feed import (
    build_notifications_feed,
    mark_all_booking_read,
    mark_single_booking_read,
    unread_booking_count,
)
from app.contracts.booking import BookingNotificationsUnreadResponse
from app.contracts.notifications import NotificationFeedResponse

router = APIRouter(prefix="/client", tags=["client"])


@router.get(
    "/notifications/bookings/unread-count",
    response_model=BookingNotificationsUnreadResponse,
)
def get_unread_booking_notifications_count(
    request: Request,
    response: Response,
) -> BookingNotificationsUnreadResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    return BookingNotificationsUnreadResponse(unread_count=unread_booking_count(uid))


@router.post("/notifications/bookings/mark-all-read")
def post_mark_booking_notifications_read(
    request: Request,
    response: Response,
) -> dict[str, bool]:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    return mark_all_booking_read(uid, notify=True)


@router.post("/notifications/bookings/{notification_id}/mark-read")
def post_mark_single_booking_notification_read(
    request: Request,
    response: Response,
    notification_id: str,
) -> dict[str, bool]:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    return mark_single_booking_read(uid, notification_id)


@router.get("/notifications/feed", response_model=NotificationFeedResponse)
def get_client_notifications_feed(request: Request, response: Response) -> NotificationFeedResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    return build_notifications_feed(uid, portal="client")
