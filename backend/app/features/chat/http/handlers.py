"""Chat handler functions — shared by the /api/v1/chat routes."""

from __future__ import annotations

from typing import Any, Literal

from app.contracts.chat import (
    ChatUnreadCountResponse,
    ConversationCreateBodyShared,
    ConversationCreateResponse,
    ConversationDetailResponse,
    ConversationRow,
    ConversationsListResponse,
    MarkReadResponse,
    MessageCreateBody,
    MessageCreateResponse,
    MessageRow,
    MessagesListResponse,
)
from app.features.bookings import vendor_can_initiate_chat
from app.features.chat.service import (
    count_unread_chat_total,
    get_conversation_for_user,
    get_or_create_conversation,
    list_conversations_for_user,
    list_messages_for_user,
    mark_conversation_read,
    send_message,
)
from app.features.realtime.sse import notify_user


def user_role(user: dict[str, Any]) -> str:
    ut = str(user.get("user_type") or "")
    return "client" if ut == "client" else "vendor" if ut == "vendor" else ""


def chat_unread_count(uid: str) -> ChatUnreadCountResponse:
    return ChatUnreadCountResponse(unread_count=count_unread_chat_total(uid))


def list_conversations(user: dict[str, Any]) -> ConversationsListResponse:
    uid = str(user.get("id") or "")
    role = user_role(user)
    if role not in ("client", "vendor"):
        from app.core.errors import ForbiddenError

        raise ForbiddenError("Chat is only available for client and vendor accounts.")
    rows = list_conversations_for_user(uid, role=role)
    return ConversationsListResponse(conversations=[ConversationRow.model_validate(r) for r in rows])


def create_conversation(user: dict[str, Any], body: ConversationCreateBodyShared) -> ConversationCreateResponse:
    uid = str(user.get("id") or "")
    peer = body.peer_user_id.strip()
    role = user_role(user)
    if role == "client":
        row = get_or_create_conversation(client_user_id=uid, vendor_user_id=peer)
        return ConversationCreateResponse(conversation=ConversationRow.model_validate(row))
    if role == "vendor":
        if not vendor_can_initiate_chat(vendor_user_id=uid, client_user_id=peer):
            from app.core.errors import ForbiddenError

            raise ForbiddenError("You can only message clients you have bookings with.")
        row = get_or_create_conversation(
            client_user_id=peer,
            vendor_user_id=uid,
            require_bookable_vendor=False,
        )
        return ConversationCreateResponse(conversation=ConversationRow.model_validate(row))
    from app.core.errors import ForbiddenError

    raise ForbiddenError("Chat is only available for client and vendor accounts.")


def get_conversation(user: dict[str, Any], conversation_id: str) -> ConversationDetailResponse:
    uid = str(user.get("id") or "")
    row = get_conversation_for_user(conversation_id, uid)
    if not row:
        from app.core.errors import NotFoundError

        raise NotFoundError("Conversation not found.")
    return ConversationDetailResponse(conversation=ConversationRow.model_validate(row))


def get_messages(user: dict[str, Any], conversation_id: str, *, limit: int) -> MessagesListResponse:
    uid = str(user.get("id") or "")
    conv = get_conversation_for_user(conversation_id, uid)
    if not conv:
        from app.core.errors import NotFoundError

        raise NotFoundError("Conversation not found.")
    rows = list_messages_for_user(conversation_id, uid, limit=limit)
    return MessagesListResponse(messages=[MessageRow.model_validate(r) for r in rows])


def post_message(user: dict[str, Any], conversation_id: str, body: MessageCreateBody) -> MessageCreateResponse:
    uid = str(user.get("id") or "")
    msg = send_message(conversation_id=conversation_id, sender_user_id=uid, body=body.body)
    notify_user(uid, "chat_unread_changed")
    conv = get_conversation_for_user(conversation_id, uid) or {}
    kind = str(conv.get("kind") or "dm")
    if kind == "dm":
        peer = str(conv.get("peer_user_id") or "")
        if peer:
            notify_user(peer, "chat_unread_changed")
    elif kind == "support":
        # Notify admin accounts so the Messages inbox refreshes live.
        try:
            from app.features.admin.team_ops import list_admin_team

            for member in list_admin_team():
                admin_id = str(member.get("user_id") or member.get("id") or "")
                if admin_id and admin_id != uid and not member.get("account_suspended"):
                    notify_user(admin_id, "chat_unread_changed")
        except Exception:
            pass
    return MessageCreateResponse(message=MessageRow.model_validate(msg))

def mark_read(user: dict[str, Any], conversation_id: str) -> MarkReadResponse:
    uid = str(user.get("id") or "")
    mark_conversation_read(conversation_id, uid)
    return MarkReadResponse()
