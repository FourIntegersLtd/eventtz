"""Chat (client–vendor) request/response models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatUnreadCountResponse(BaseModel):
    success: bool = True
    unread_count: int


class ConversationCreateBody(BaseModel):
    vendor_user_id: str = Field(min_length=1)


class ConversationCreateBodyShared(BaseModel):
    peer_user_id: str = Field(min_length=1)


class ConversationRow(BaseModel):
    id: str
    client_user_id: str
    vendor_user_id: str
    peer_user_id: str
    peer_display_name: str
    created_at: str | None = None
    last_message_at: str | None = None
    unread_count: int = 0


class ConversationsListResponse(BaseModel):
    success: bool = True
    conversations: list[ConversationRow]


class ConversationDetailResponse(BaseModel):
    success: bool = True
    conversation: ConversationRow


class MessageRow(BaseModel):
    id: str
    sender_user_id: str
    body: str
    created_at: str | None = None
    #: Structured payload for non-plain-text messages, e.g. a quote card
    #: ({"kind": "quote", "booking_request_id": ..., "event_name": ..., "total_label": ..., "status": ...}).
    metadata: dict[str, Any] | None = None


class MessagesListResponse(BaseModel):
    success: bool = True
    messages: list[MessageRow]


class MessageCreateBody(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class MessageCreateResponse(BaseModel):
    success: bool = True
    message: MessageRow


class ConversationCreateResponse(BaseModel):
    success: bool = True
    conversation: ConversationRow


class MarkReadResponse(BaseModel):
    success: bool = True
