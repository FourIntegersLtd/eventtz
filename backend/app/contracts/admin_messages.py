"""Shared types for admin messages to users (Eventtz Support threads)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AdminMessageSendBody(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    #: When set, sends to all users of that type (optionally combined with recipient_user_ids).
    audience: Literal["clients", "vendors", "users"] | None = None
    recipient_user_ids: list[str] | None = None


class AdminMessageSendFailure(BaseModel):
    user_id: str
    error: str


class AdminMessageSendResponse(BaseModel):
    success: bool = True
    sent: int
    conversation_ids: list[str]
    failures: list[AdminMessageSendFailure] | None = None


class AdminSupportConversationRow(BaseModel):
    id: str
    kind: Literal["support"] = "support"
    support_user_id: str
    peer_user_id: str
    peer_display_name: str
    created_at: str | None = None
    last_message_at: str | None = None
    unread_count: int = 0


class AdminSupportConversationsListResponse(BaseModel):
    success: bool = True
    conversations: list[AdminSupportConversationRow]


class AdminSupportConversationDetailResponse(BaseModel):
    success: bool = True
    conversation: AdminSupportConversationRow


class AdminSupportMessageRow(BaseModel):
    id: str
    sender_user_id: str
    body: str
    created_at: str | None = None
    metadata: dict[str, Any] | None = None


class AdminSupportMessagesListResponse(BaseModel):
    success: bool = True
    messages: list[AdminSupportMessageRow]


class AdminSupportMessageCreateBody(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class AdminSupportMessageCreateResponse(BaseModel):
    success: bool = True
    message: AdminSupportMessageRow


class AdminSupportMarkReadResponse(BaseModel):
    success: bool = True
