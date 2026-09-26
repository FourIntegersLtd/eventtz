"""Chat rules with no I/O: who is in a thread, which read cursor is theirs, and how items are shaped.

A conversation is either a client-vendor DM or one end user's Eventtz Support
thread. On a support thread the end user is `support_user_id`, their read cursor is
`client_last_read_at` (whether they are a client or a vendor), and every staff
member shares `admin_last_read_at`.
"""

from __future__ import annotations

from typing import Any, Literal

from app.features.messaging.domain_sanitize import message_plain_text, sanitize_message_html
from app.features.messaging.errors import MAX_MESSAGE_LENGTH, MessageEmpty, MessageTooLong
from app.features.messaging.rows import StoredMessageRow, ThreadRow

# Stored HTML for staff messages may be longer than its visible text (tags, lists, links).
MAX_STORED_BODY_LENGTH = 15000

# The fixed peer a user sees on their support thread, and the mask staff senders wear.
SUPPORT_PEER_USER_ID = "eventtz-support"
SUPPORT_PEER_DISPLAY = "Eventtz Support"
ADMIN_SENDER_USER_ID = "eventtz-admin"
ADMIN_SENDER_DISPLAY = "Eventtz Admin"

CLIENT_DISPLAY_FALLBACK = "Client"
VENDOR_DISPLAY_FALLBACK = "Vendor"
USER_DISPLAY_FALLBACK = "User"

# Every staff message is sanitised HTML; the web renders it as such.
STAFF_MESSAGE_METADATA = {"kind": "admin", "format": "html"}

# The live-update event that tells a user's badge and inbox to refresh.
CHAT_UNREAD_CHANGED = "chat_unread_changed"

Role = Literal["client", "vendor", "support_user"]


def is_support(thread: ThreadRow) -> bool:
    """True for an Eventtz Support thread; anything else (including a blank kind) is a DM."""
    return (thread.kind or "dm").strip().lower() == "support"


def role_in_conversation(thread: ThreadRow, user_id: str) -> Role | None:
    """The user's place in the thread, or `None` when they are not part of it."""
    if not user_id:
        return None
    if is_support(thread):
        return "support_user" if user_id == thread.support_user_id else None
    if user_id == thread.client_user_id:
        return "client"
    if user_id == thread.vendor_user_id:
        return "vendor"
    return None


def read_cursor_column(role: Role) -> str:
    """The `conversations` column holding this participant's "read up to" time."""
    return "vendor_last_read_at" if role == "vendor" else "client_last_read_at"


def dm_peer_id(thread: ThreadRow, viewer_id: str) -> str:
    """The other person on a DM: the vendor when the viewer is the client, else the client."""
    if viewer_id == thread.client_user_id:
        return thread.vendor_user_id or ""
    return thread.client_user_id or ""


def conversation_item(
    thread: ThreadRow, viewer_id: str, *, peer_display_name: str, unread_count: int
) -> dict[str, Any]:
    """One inbox row as the viewer sees it. Support threads always show "Eventtz Support" as the peer."""
    if is_support(thread):
        return {
            "id": thread.id,
            "kind": "support",
            "support_user_id": thread.support_user_id or None,
            "client_user_id": "",
            "vendor_user_id": "",
            "peer_user_id": SUPPORT_PEER_USER_ID,
            "peer_display_name": SUPPORT_PEER_DISPLAY,
            "created_at": thread.created_at,
            "last_message_at": thread.last_message_at,
            "unread_count": unread_count,
        }
    return {
        "id": thread.id,
        "kind": "dm",
        "support_user_id": None,
        "client_user_id": thread.client_user_id or "",
        "vendor_user_id": thread.vendor_user_id or "",
        "peer_user_id": dm_peer_id(thread, viewer_id),
        "peer_display_name": peer_display_name,
        "created_at": thread.created_at,
        "last_message_at": thread.last_message_at,
        "unread_count": unread_count,
    }


def staff_inbox_item(thread: ThreadRow, *, peer_display_name: str, unread_count: int) -> dict[str, Any]:
    """One row of the staff support inbox: the end user is the peer."""
    support_user_id = thread.support_user_id or ""
    return {
        "id": thread.id,
        "kind": "support",
        "support_user_id": support_user_id,
        "peer_user_id": support_user_id,
        "peer_display_name": peer_display_name,
        "created_at": thread.created_at,
        "last_message_at": thread.last_message_at,
        "unread_count": unread_count,
    }


def client_peer_label(*, user_type: str | None, client_name: str | None) -> str:
    """What a vendor sees for the client side of a DM. Staff never show their own email."""
    if user_type == "admin":
        return ADMIN_SENDER_DISPLAY
    return client_name or CLIENT_DISPLAY_FALLBACK


def staff_peer_label(email_label: str | None) -> str:
    """What staff see for the end user on a support thread: their email, else "User"."""
    return email_label or USER_DISPLAY_FALLBACK


def message_item(message: StoredMessageRow, *, support_user_id: str | None) -> dict[str, Any]:
    """A message as a participant sees it. On a support thread, staff senders are masked."""
    item: dict[str, Any] = {
        "id": message.id,
        "sender_user_id": message.sender_user_id,
        "body": message.body,
        "created_at": message.created_at,
        "metadata": message.metadata if isinstance(message.metadata, dict) else None,
    }
    if support_user_id and message.sender_user_id != support_user_id:
        item["sender_user_id"] = ADMIN_SENDER_USER_ID
        item["sender_display_name"] = ADMIN_SENDER_DISPLAY
    return item


def raw_message_item(message: StoredMessageRow) -> dict[str, Any]:
    """A message as staff see it: real sender ids, metadata kept."""
    return {
        "id": message.id,
        "sender_user_id": message.sender_user_id,
        "body": message.body,
        "created_at": message.created_at,
        "metadata": message.metadata if isinstance(message.metadata, dict) else None,
    }


def user_message_body(raw: str) -> str:
    """A person's typed message, trimmed. Raises when it is blank or too long."""
    text = raw.strip()
    if not text:
        raise MessageEmpty()
    if len(text) > MAX_MESSAGE_LENGTH:
        raise MessageTooLong()
    return text


def staff_message_body(raw: str) -> str:
    """A staff message sanitised to safe HTML. Raises when it has no visible text or is too long.

    The visible text is held to the same limit as a typed message; the stored
    HTML may be longer, up to `MAX_STORED_BODY_LENGTH`.
    """
    html = sanitize_message_html(raw.strip())
    plain = message_plain_text(html)
    if not plain:
        raise MessageEmpty()
    if len(plain) > MAX_MESSAGE_LENGTH or len(html) > MAX_STORED_BODY_LENGTH:
        raise MessageTooLong()
    return html


def edited_metadata(existing: dict[str, Any] | None, *, edited_at: str) -> dict[str, Any]:
    """Metadata after a staff edit: the existing keys, re-marked as staff HTML, stamped `edited_at`."""
    metadata = dict(existing) if isinstance(existing, dict) else dict(STAFF_MESSAGE_METADATA)
    metadata.update(STAFF_MESSAGE_METADATA)
    metadata["edited_at"] = edited_at
    return metadata


def unique_recipient_ids(*groups: list[str]) -> list[str]:
    """Recipient ids trimmed, blanks dropped and duplicates removed, first occurrence kept."""
    seen: set[str] = set()
    recipients: list[str] = []
    for group in groups:
        for raw_id in group:
            user_id = (raw_id or "").strip()
            if user_id and user_id not in seen:
                seen.add(user_id)
                recipients.append(user_id)
    return recipients


def messages_portal(user_type: str | None) -> str | None:
    """The portal whose inbox links a support email should open, or `None` for staff."""
    return user_type if user_type in ("client", "vendor") else None
