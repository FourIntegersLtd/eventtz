"""Request and response bodies for chat and the staff support inbox, named as in the baseline contract."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.pagination import PagedResponse


class ChatUnreadCountResponse(BaseModel):
    """How many messages are waiting for the caller across all their threads."""

    success: bool = True
    unread_count: int


class ConversationCreateBodyShared(BaseModel):
    """Open (or reopen) a DM: a client names a vendor, a vendor names a client they have bookings with."""

    peer_user_id: str = Field(min_length=1)


class ConversationRow(BaseModel):
    """One inbox row. On a support thread the peer is always "Eventtz Support"."""

    id: str
    client_user_id: str = ""
    vendor_user_id: str = ""
    peer_user_id: str
    peer_display_name: str
    kind: Literal["dm", "support"] = "dm"
    support_user_id: str | None = None
    created_at: str | None = None
    last_message_at: str | None = None
    unread_count: int = 0


class ConversationsListResponse(PagedResponse):
    """The caller's threads, newest activity first."""

    success: bool = True
    conversations: list[ConversationRow]


class ConversationDetailResponse(BaseModel):
    """One of the caller's threads."""

    success: bool = True
    conversation: ConversationRow


class ConversationCreateResponse(BaseModel):
    """The DM thread that was opened or already existed."""

    success: bool = True
    conversation: ConversationRow


class MessageRow(BaseModel):
    """One message. Staff senders on a support thread appear as "Eventtz Admin", never by email."""

    id: str
    sender_user_id: str
    body: str
    created_at: str | None = None
    sender_display_name: str | None = None
    # Extra data for rich messages, e.g. a quote card
    # ({"kind": "quote", "booking_request_id": ..., "event_name": ..., "total_label": ..., "status": ...}).
    metadata: dict[str, Any] | None = None


class MessagesListResponse(BaseModel):
    """The newest messages of a thread, oldest first."""

    success: bool = True
    messages: list[MessageRow]


class MessageCreateBody(BaseModel):
    """A typed message."""

    body: str = Field(min_length=1, max_length=5000)


class MessageCreateResponse(BaseModel):
    """The message as stored."""

    success: bool = True
    message: MessageRow


class MarkReadResponse(BaseModel):
    """The thread is marked read for the caller."""

    success: bool = True


class AdminMessageSendBody(BaseModel):
    """A staff message to named users and/or a whole audience (audiences are super admin only)."""

    body: str = Field(min_length=1, max_length=15000)
    # When set, sends to every account of that type (combined with any named recipients).
    audience: Literal["clients", "vendors", "users"] | None = None
    recipient_user_ids: list[str] | None = None


class AdminMessageSendFailure(BaseModel):
    """A recipient the message could not reach, and why."""

    user_id: str
    error: str


class AdminMessageSendResponse(BaseModel):
    """How many support threads received the message, which ones, and any failures."""

    success: bool = True
    sent: int
    conversation_ids: list[str]
    failures: list[AdminMessageSendFailure] | None = None


class AdminSupportConversationRow(BaseModel):
    """One row of the staff support inbox: the end user is the peer."""

    id: str
    kind: Literal["support"] = "support"
    support_user_id: str
    peer_user_id: str
    peer_display_name: str
    created_at: str | None = None
    last_message_at: str | None = None
    unread_count: int = 0


class AdminSupportConversationsListResponse(PagedResponse):
    """The newest support threads."""

    success: bool = True
    conversations: list[AdminSupportConversationRow]


class AdminSupportConversationDetailResponse(BaseModel):
    """One support thread."""

    success: bool = True
    conversation: AdminSupportConversationRow


class AdminSupportMessageRow(BaseModel):
    """A support message as staff see it, with the real sender id."""

    id: str
    sender_user_id: str
    body: str
    created_at: str | None = None
    metadata: dict[str, Any] | None = None


class AdminSupportMessagesListResponse(BaseModel):
    """The newest messages of a support thread, oldest first."""

    success: bool = True
    messages: list[AdminSupportMessageRow]


class AdminSupportMessageCreateBody(BaseModel):
    """A staff reply, as rich-text HTML (sanitised before it is stored)."""

    body: str = Field(min_length=1, max_length=15000)


class AdminSupportMessageCreateResponse(BaseModel):
    """The reply as stored."""

    success: bool = True
    message: AdminSupportMessageRow


class AdminSupportMessageEditBody(BaseModel):
    """New rich-text HTML for a staff member's own message."""

    body: str = Field(min_length=1, max_length=15000)


class AdminSupportMessageEditResponse(BaseModel):
    """The message after the edit, stamped `metadata.edited_at`."""

    success: bool = True
    message: AdminSupportMessageRow


class AdminSupportMarkReadResponse(BaseModel):
    """The support thread is marked read for staff."""

    success: bool = True


class AdminChatMessageItem(BaseModel):
    """A message in the staff viewer for any thread (DMs included)."""

    id: str
    sender_user_id: str
    body: str
    created_at: str | None = None


class AdminConversationMessagesResponse(BaseModel):
    """Any thread's first messages plus who is on it, for staff investigating a DM."""

    success: bool = True
    conversation_id: str
    messages: list[AdminChatMessageItem]
    client_user_id: str | None = None
    vendor_user_id: str | None = None
    client_email: str | None = None
    vendor_display_name: str | None = None
