"""Shared types for the updates feed on client and vendor dashboards."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


NotificationFeedKind = Literal["booking_update", "dispute_update", "chat_unread_summary"]


class NotificationFeedItem(BaseModel):
    kind: NotificationFeedKind
    created_at: str | None = None

    title: str = Field(min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=2000)

    # For booking_update items, the id of the booking_notifications row.
    notification_id: str | None = None
    booking_id: str | None = None

    # Optional link to open in the app.
    href: str | None = None

    # Whether the item counts as unread (not used for every item type).
    unread: bool | None = None


class NotificationFeedResponse(BaseModel):
    success: bool = True
    items: list[NotificationFeedItem]

