"""Client–vendor chat and Eventtz Support threads (conversations + messages).

Re-export facade — import from here for stable public API.
"""

from __future__ import annotations

from app.features.chat.chat_shared import (
    LOCAL_CONVERSATION_ID,
    MAX_MESSAGE_LEN,
    SUPPORT_PEER_DISPLAY,
    SUPPORT_PEER_USER_ID,
    ConversationKind,
    insert_message,
)
from app.features.chat.dm import (
    _assert_vendor_exists,
    assert_conversation_matches_pair,
    count_unread_chat_total,
    get_conversation_for_user,
    get_or_create_conversation,
    list_conversations_for_user,
    list_messages_for_user,
    mark_conversation_read,
    send_message,
    send_quote_message,
)
from app.features.chat.support_admin import (
    admin_reply_support_message,
    admin_send_support_message,
    get_or_create_support_conversation,
    get_support_conversation_for_admin,
    list_messages_for_admin_support,
    list_support_conversations_for_admin,
    mark_support_conversation_read_admin,
)

__all__ = [
    "LOCAL_CONVERSATION_ID",
    "MAX_MESSAGE_LEN",
    "SUPPORT_PEER_DISPLAY",
    "SUPPORT_PEER_USER_ID",
    "ConversationKind",
    "_assert_vendor_exists",
    "admin_reply_support_message",
    "admin_send_support_message",
    "assert_conversation_matches_pair",
    "count_unread_chat_total",
    "get_conversation_for_user",
    "get_or_create_conversation",
    "get_or_create_support_conversation",
    "get_support_conversation_for_admin",
    "insert_message",
    "list_conversations_for_user",
    "list_messages_for_admin_support",
    "list_messages_for_user",
    "list_support_conversations_for_admin",
    "mark_conversation_read",
    "mark_support_conversation_read_admin",
    "send_message",
    "send_quote_message",
]
