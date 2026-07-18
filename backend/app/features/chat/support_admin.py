"""Eventtz Support threads and admin support inbox logic."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.errors import NotFoundError, ServiceUnavailableError
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.auth.lookup import user_emails_by_id
from app.features.realtime.sse import notify_user

from app.features.chat.chat_shared import (
    MAX_MESSAGE_LEN,
    SUPPORT_PEER_DISPLAY,
    SUPPORT_PEER_USER_ID,
    _messages_table_select,
    _now_iso,
    _row_to_admin_support_item,
    _row_to_conversation_list_item,
    _str_id,
    insert_message,
)

logger = get_logger(__name__)


def get_or_create_support_conversation(user_id: str) -> dict[str, Any]:
    """One Eventtz Support thread per end user (client or vendor)."""
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("We couldn't start that conversation. Please try again.")
    if get_settings().local_auth_mode:
        return {
            "id": f"00000000-0000-4000-8000-{uid.replace('-', '')[:12].ljust(12, '0')}",
            "kind": "support",
            "support_user_id": uid,
            "client_user_id": "",
            "vendor_user_id": "",
            "peer_user_id": SUPPORT_PEER_USER_ID,
            "peer_display_name": SUPPORT_PEER_DISPLAY,
            "created_at": None,
            "last_message_at": None,
            "unread_count": 0,
        }

    client = get_client()
    try:
        existing = (
            client.table("conversations")
            .select("*")
            .eq("kind", "support")
            .eq("support_user_id", uid)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.exception("chat: get support conversation failed")
        raise RuntimeError("Could not load support conversation.") from e
    data = getattr(existing, "data", None) or []
    if data and isinstance(data[0], dict):
        row = data[0]
    else:
        try:
            ins = (
                client.table("conversations")
                .insert(
                    {
                        "kind": "support",
                        "support_user_id": uid,
                        "client_user_id": None,
                        "vendor_user_id": None,
                    },
                )
                .execute()
            )
        except Exception as e:
            logger.exception("chat: insert support conversation failed")
            raise RuntimeError("Could not start support conversation.") from e
        ins_data = getattr(ins, "data", None) or []
        if not ins_data or not isinstance(ins_data[0], dict):
            raise RuntimeError("Could not start support conversation.")
        row = ins_data[0]

    return _row_to_conversation_list_item(row, uid, {})


def admin_send_support_message(
    *,
    admin_user_id: str,
    recipient_user_ids: list[str],
    body: str,
) -> dict[str, Any]:
    """Send one support message per recipient. Returns sent count and conversation ids."""
    text = body.strip()
    if not text:
        raise ValueError("Message cannot be empty.")
    if len(text) > MAX_MESSAGE_LEN:
        raise ValueError(f"Message is too long (max {MAX_MESSAGE_LEN} characters).")

    seen: set[str] = set()
    recipients: list[str] = []
    for raw in recipient_user_ids:
        uid = (raw or "").strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        recipients.append(uid)
    if not recipients:
        raise ValueError("At least one recipient is required.")

    conversation_ids: list[str] = []
    failures: list[dict[str, str]] = []
    metadata = {"kind": "admin"}

    for uid in recipients:
        try:
            conv = get_or_create_support_conversation(uid)
            cid = _str_id(conv.get("id"))
            insert_message(
                conversation_id=cid,
                sender_user_id=admin_user_id,
                body=text,
                metadata=metadata,
            )
            conversation_ids.append(cid)
            notify_user(uid, "chat_unread_changed")
        except Exception as e:
            logger.warning("chat: admin send failed recipient=%s: %s", uid, e, exc_info=True)
            failures.append({"user_id": uid, "error": str(e) or "Failed to send."})

    notify_user(admin_user_id, "chat_unread_changed")
    return {
        "sent": len(conversation_ids),
        "conversation_ids": conversation_ids,
        "failures": failures or None,
    }


def list_support_conversations_for_admin(*, limit: int = 200) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    lim = max(1, min(limit, 500))
    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("conversations")
                .select("*")
                .eq("kind", "support"),
                column="last_message_at",
                tie_breaker="created_at",
            )
            .limit(lim)
            .execute()
        )
    except Exception:
        logger.exception("chat: list support conversations for admin failed")
        return []
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    uids = [_str_id(r.get("support_user_id")) for r in rows if r.get("support_user_id")]
    emails = user_emails_by_id(list({u for u in uids if u}))
    labels = {u: (emails.get(u) or "User") for u in uids if u}
    return [_row_to_admin_support_item(r, labels) for r in rows]


def get_support_conversation_for_admin(conversation_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    try:
        res = (
            get_client()
            .table("conversations")
            .select("*")
            .eq("id", conversation_id)
            .eq("kind", "support")
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("chat: get support conversation for admin failed")
        return None
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    row = data[0]
    uid = _str_id(row.get("support_user_id"))
    emails = user_emails_by_id([uid] if uid else [])
    labels = {uid: emails.get(uid) or "User"} if uid else {}
    return _row_to_admin_support_item(row, labels)


def list_messages_for_admin_support(conversation_id: str, *, limit: int = 200) -> list[dict[str, Any]]:
    conv = get_support_conversation_for_admin(conversation_id)
    if not conv:
        return []
    lim = max(1, min(limit, 500))
    if get_settings().local_auth_mode:
        return []
    try:
        rows = _messages_table_select(get_client(), conversation_id, limit=lim)
    except Exception:
        logger.exception("chat: list admin support messages failed")
        return []
    rows = list(reversed(rows))
    out: list[dict[str, Any]] = []
    for row in rows:
        metadata = row.get("metadata")
        out.append(
            {
                "id": _str_id(row.get("id")),
                "sender_user_id": _str_id(row.get("sender_user_id")),
                "body": str(row.get("body") or ""),
                "created_at": row.get("created_at"),
                "metadata": metadata if isinstance(metadata, dict) else None,
            },
        )
    return out


def admin_reply_support_message(
    *,
    conversation_id: str,
    admin_user_id: str,
    body: str,
) -> dict[str, Any]:
    conv = get_support_conversation_for_admin(conversation_id)
    if not conv:
        raise NotFoundError("Support conversation not found.")
    msg = insert_message(
        conversation_id=conversation_id,
        sender_user_id=admin_user_id,
        body=body,
        metadata={"kind": "admin"},
    )
    peer = _str_id(conv.get("support_user_id") or conv.get("peer_user_id"))
    if peer:
        notify_user(peer, "chat_unread_changed")
    notify_user(admin_user_id, "chat_unread_changed")
    return msg


def mark_support_conversation_read_admin(conversation_id: str) -> None:
    if get_settings().local_auth_mode:
        return
    conv = get_support_conversation_for_admin(conversation_id)
    if not conv:
        raise NotFoundError("Support conversation not found.")
    try:
        get_client().table("conversations").update(
            {"admin_last_read_at": _now_iso()},
        ).eq("id", conversation_id).execute()
    except Exception as e:
        logger.exception("chat: mark admin support read failed")
        raise ServiceUnavailableError("Could not update read state.") from e
