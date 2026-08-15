"""Eventtz Support threads and admin support inbox logic."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.errors import ForbiddenError, NotFoundError, ServiceUnavailableError
from app.core.db import apply_recent_first_order, get_db
from app.features.auth.user_vendor_display_lookup import user_emails_by_id
from app.features.email.dispatch import send_support_new_message_email
from app.features.realtime.sse import notify_user

from app.features.chat import messages as chat_messages
from app.features.chat.chat_formatting_and_ids import (
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


def _email_support_message_recipient(*, recipient_user_id: str, conversation_id: str) -> None:
    try:
        send_support_new_message_email(
            recipient_user_id=recipient_user_id,
            conversation_id=conversation_id,
        )
    except Exception:
        logger.warning(
            "chat: support message email failed recipient=%s conv=%s",
            recipient_user_id,
            conversation_id,
            exc_info=True,
        )


def get_or_create_support_conversation(user_id: str) -> dict[str, Any]:
    """One Eventtz Support thread per end user (client or vendor)."""
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError(chat_messages.SUPPORT_START_FAILED)
    client = get_db()
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
        raise RuntimeError(chat_messages.SUPPORT_CONVERSATION_LOAD_FAILED) from e
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
            raise RuntimeError(chat_messages.SUPPORT_CONVERSATION_START_FAILED) from e
        ins_data = getattr(ins, "data", None) or []
        if not ins_data or not isinstance(ins_data[0], dict):
            raise RuntimeError(chat_messages.SUPPORT_CONVERSATION_START_FAILED)
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
        raise ValueError(chat_messages.MESSAGE_EMPTY)
    if len(text) > MAX_MESSAGE_LEN:
        raise ValueError(chat_messages.message_too_long_detail(MAX_MESSAGE_LEN))

    seen: set[str] = set()
    recipients: list[str] = []
    for raw in recipient_user_ids:
        uid = (raw or "").strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        recipients.append(uid)
    if not recipients:
        raise ValueError(chat_messages.RECIPIENTS_REQUIRED)

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
            _email_support_message_recipient(recipient_user_id=uid, conversation_id=cid)
        except Exception as e:
            logger.warning("chat: admin send failed recipient=%s: %s", uid, e, exc_info=True)
            failures.append({"user_id": uid, "error": str(e) or chat_messages.SEND_FAILED})

    notify_user(admin_user_id, "chat_unread_changed")
    return {
        "sent": len(conversation_ids),
        "conversation_ids": conversation_ids,
        "failures": failures or None,
    }


def list_support_conversations_for_admin(*, limit: int = 200) -> list[dict[str, Any]]:
    lim = max(1, min(limit, 500))
    try:
        res = (
            apply_recent_first_order(
                get_db()
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
    labels = {u: (emails.get(u) or chat_messages.USER_DISPLAY_FALLBACK) for u in uids if u}
    return [_row_to_admin_support_item(r, labels) for r in rows]


def get_support_conversation_for_admin(conversation_id: str) -> dict[str, Any] | None:
    try:
        res = (
            get_db()
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
    labels = {uid: emails.get(uid) or chat_messages.USER_DISPLAY_FALLBACK} if uid else {}
    return _row_to_admin_support_item(row, labels)


def list_messages_for_admin_support(conversation_id: str, *, limit: int = 200) -> list[dict[str, Any]]:
    conv = get_support_conversation_for_admin(conversation_id)
    if not conv:
        return []
    lim = max(1, min(limit, 500))
    try:
        rows = _messages_table_select(get_db(), conversation_id, limit=lim)
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


def admin_edit_support_message(
    *,
    conversation_id: str,
    message_id: str,
    admin_user_id: str,
    body: str,
) -> dict[str, Any]:
    conv = get_support_conversation_for_admin(conversation_id)
    if not conv:
        raise NotFoundError(chat_messages.SUPPORT_CONVERSATION_NOT_FOUND)

    text = body.strip()
    if not text:
        raise ValueError(chat_messages.MESSAGE_EMPTY)
    if len(text) > MAX_MESSAGE_LEN:
        raise ValueError(chat_messages.message_too_long_detail(MAX_MESSAGE_LEN))

    client = get_db()
    try:
        res = (
            client.table("messages")
            .select("id,sender_user_id,body,created_at,metadata")
            .eq("id", message_id)
            .eq("conversation_id", conversation_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.exception("chat: load message for edit failed")
        raise ServiceUnavailableError(chat_messages.MESSAGE_LOAD_FAILED) from e

    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise NotFoundError(chat_messages.MESSAGE_NOT_FOUND)

    row = data[0]
    support_uid = _str_id(conv.get("support_user_id"))
    sender = _str_id(row.get("sender_user_id"))
    if support_uid and sender == support_uid:
        raise ForbiddenError(chat_messages.STAFF_MESSAGES_ONLY)
    if sender != admin_user_id:
        raise ForbiddenError(chat_messages.EDIT_OWN_MESSAGES_ONLY)

    metadata = row.get("metadata")
    meta: dict[str, Any] = dict(metadata) if isinstance(metadata, dict) else {"kind": "admin"}
    meta["kind"] = "admin"
    meta["edited_at"] = _now_iso()

    try:
        upd = (
            client.table("messages")
            .update({"body": text, "metadata": meta})
            .eq("id", message_id)
            .eq("conversation_id", conversation_id)
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "metadata" in msg and ("does not exist" in msg or "42703" in msg):
            try:
                upd = (
                    client.table("messages")
                    .update({"body": text})
                    .eq("id", message_id)
                    .eq("conversation_id", conversation_id)
                    .execute()
                )
            except Exception as e2:
                logger.exception("chat: edit message failed")
                raise ServiceUnavailableError(chat_messages.MESSAGE_UPDATE_FAILED) from e2
        else:
            logger.exception("chat: edit message failed")
            raise ServiceUnavailableError(chat_messages.MESSAGE_UPDATE_FAILED) from e

    upd_data = getattr(upd, "data", None) or []
    updated = upd_data[0] if upd_data and isinstance(upd_data[0], dict) else row
    peer = support_uid
    if peer:
        notify_user(peer, "chat_unread_changed")

    return {
        "id": _str_id(updated.get("id") or message_id),
        "sender_user_id": sender,
        "body": str(updated.get("body") or text),
        "created_at": updated.get("created_at") or row.get("created_at"),
        "metadata": meta,
    }


def admin_reply_support_message(
    *,
    conversation_id: str,
    admin_user_id: str,
    body: str,
) -> dict[str, Any]:
    conv = get_support_conversation_for_admin(conversation_id)
    if not conv:
        raise NotFoundError(chat_messages.SUPPORT_CONVERSATION_NOT_FOUND)
    msg = insert_message(
        conversation_id=conversation_id,
        sender_user_id=admin_user_id,
        body=body,
        metadata={"kind": "admin"},
    )
    peer = _str_id(conv.get("support_user_id") or conv.get("peer_user_id"))
    if peer:
        notify_user(peer, "chat_unread_changed")
        _email_support_message_recipient(recipient_user_id=peer, conversation_id=conversation_id)
    notify_user(admin_user_id, "chat_unread_changed")
    return msg


def mark_support_conversation_read_admin(conversation_id: str) -> None:
    conv = get_support_conversation_for_admin(conversation_id)
    if not conv:
        raise NotFoundError(chat_messages.SUPPORT_CONVERSATION_NOT_FOUND)
    try:
        get_db().table("conversations").update(
            {"admin_last_read_at": _now_iso()},
        ).eq("id", conversation_id).execute()
    except Exception as e:
        logger.exception("chat: mark admin support read failed")
        raise ServiceUnavailableError(chat_messages.READ_STATE_UPDATE_FAILED) from e
