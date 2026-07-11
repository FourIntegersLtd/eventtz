"""Unified updates feed models for dashboards (client + vendor)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


NotificationFeedKind = Literal["booking_update", "dispute_update", "chat_unread_summary"]


class NotificationFeedItem(BaseModel):
    kind: NotificationFeedKind
    created_at: str | None = None

    title: str = Field(min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=2000)

    # For booking_update items, this identifies the booking_notifications row.
    notification_id: str | None = None
    booking_id: str | None = None

    # Optional deep link
    href: str | None = None

    # Optional "unread" semantics (not always meaningful for every item)
    unread: bool | None = None


class NotificationFeedResponse(BaseModel):
    success: bool = True
    items: list[NotificationFeedItem]

