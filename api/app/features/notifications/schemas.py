"""Request and response shapes for the in-app notification routes (the baseline's contract)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.core.pagination import DEFAULT_LIST_LIMIT

NotificationFeedKind = Literal["booking_update", "dispute_update", "chat_unread_summary"]


class BookingNotificationsUnreadResponse(BaseModel):
    """How many booking notices the caller has not read (the dashboard bell badge)."""

    success: bool = True
    unread_count: int


class NotificationMarkReadResponse(BaseModel):
    """Whether the mark-read changed anything; marking one notice is false for an id that is not yours."""

    success: bool


class NotificationFeedItem(BaseModel):
    """One line in the dashboard feed: a booking notice, a dispute, or the unread-chat summary."""

    kind: NotificationFeedKind
    created_at: str | None = None
    title: str = Field(min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=2000)
    # For booking_update items, the id of the booking_notifications row.
    notification_id: str | None = None
    booking_id: str | None = None
    # Where the item opens in the app.
    href: str | None = None
    # Whether the item counts as unread (not every kind has read state).
    unread: bool | None = None


class NotificationFeedResponse(BaseModel):
    """The caller's feed, newest first."""

    success: bool = True
    items: list[NotificationFeedItem]
    total: int = 0
    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT
