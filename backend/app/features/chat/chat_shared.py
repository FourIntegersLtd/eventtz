"""Shared chat helpers used by DM and support/admin modules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client

logger = get_logger(__name__)

MAX_MESSAGE_LEN = 5000
LOCAL_CONVERSATION_ID = "00000000-0000-4000-8000-000000000c01"
SUPPORT_PEER_DISPLAY = "Eventtz Support"
SUPPORT_PEER_USER_ID = "eventtz-support"

ConversationKind = Literal["dm", "support"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _str_id(v: Any) -> str:
    return str(v) if v is not None else ""


def _conversation_kind(row: dict[str, Any]) -> ConversationKind:
    k = str(row.get("kind") or "dm").strip().lower()
    return "support" if k == "support" else "dm"


def _role_in_conversation(row: dict[str, Any], user_id: str) -> str | None:
    """Return participant role: client | vendor | support_user."""
    if _conversation_kind(row) == "support":
        if user_id and user_id == _str_id(row.get("support_user_id")):
            return "support_user"
        return None
    c = _str_id(row.get("client_user_id"))
    v = _str_id(row.get("vendor_user_id"))
    if user_id == c:
        return "client"
    if user_id == v:
        return "vendor"
    return None


def _count_unread_for_user(conv: dict[str, Any], user_id: str) -> int:
    if get_settings().local_auth_mode:
        return 0
    role = _role_in_conversation(conv, user_id)
    if not role:
        return 0
    if role == "support_user":
        # On support threads, client_last_read_at tracks when the end user last read.
        lr = conv.get("client_last_read_at")
    elif role == "client":
        lr = conv.get("client_last_read_at")
    else:
        lr = conv.get("vendor_last_read_at")
    cid = _str_id(conv.get("id"))
    try:
        q = (
            get_client()
            .table("messages")
            .select("id")
            .eq("conversation_id", cid)
            .neq("sender_user_id", user_id)
        )
        if lr is not None:
            q = q.gt("created_at", lr)
        res = q.execute()
    except Exception:
        logger.exception("chat: count unread failed conv=%s", cid)
        return 0
    data = getattr(res, "data", None) or []
    return len(data) if isinstance(data, list) else 0


def _count_unread_for_admin(conv: dict[str, Any]) -> int:
    if get_settings().local_auth_mode:
        return 0
    if _conversation_kind(conv) != "support":
        return 0
    lr = conv.get("admin_last_read_at")
    cid = _str_id(conv.get("id"))
    support_uid = _str_id(conv.get("support_user_id"))
    try:
        q = (
            get_client()
            .table("messages")
            .select("id")
            .eq("conversation_id", cid)
        )
        if support_uid:
            q = q.eq("sender_user_id", support_uid)
        if lr is not None:
            q = q.gt("created_at", lr)
        res = q.execute()
    except Exception:
        logger.exception("chat: count admin unread failed conv=%s", cid)
        return 0
    data = getattr(res, "data", None) or []
    return len(data) if isinstance(data, list) else 0


def _row_to_conversation_list_item(
    row: dict[str, Any],
    user_id: str,
    peer_names: dict[str, str],
) -> dict[str, Any]:
    kind = _conversation_kind(row)
    if kind == "support":
        support_uid = _str_id(row.get("support_user_id"))
        return {
            "id": _str_id(row.get("id")),
            "kind": "support",
            "support_user_id": support_uid or None,
            "client_user_id": "",
            "vendor_user_id": "",
            "peer_user_id": SUPPORT_PEER_USER_ID,
            "peer_display_name": SUPPORT_PEER_DISPLAY,
            "created_at": row.get("created_at"),
            "last_message_at": row.get("last_message_at"),
            "unread_count": _count_unread_for_user(row, user_id),
        }

    c = _str_id(row.get("client_user_id"))
    v = _str_id(row.get("vendor_user_id"))
    is_client = user_id == c
    peer = v if is_client else c
    peer_display = peer_names.get(peer, "Unknown")
    unread = _count_unread_for_user(row, user_id)
    return {
        "id": _str_id(row.get("id")),
        "kind": "dm",
        "support_user_id": None,
        "client_user_id": c,
        "vendor_user_id": v,
        "peer_user_id": peer,
        "peer_display_name": peer_display,
        "created_at": row.get("created_at"),
        "last_message_at": row.get("last_message_at"),
        "unread_count": unread,
    }


def _row_to_admin_support_item(row: dict[str, Any], user_labels: dict[str, str]) -> dict[str, Any]:
    support_uid = _str_id(row.get("support_user_id"))
    return {
        "id": _str_id(row.get("id")),
        "kind": "support",
        "support_user_id": support_uid,
        "peer_user_id": support_uid,
        "peer_display_name": user_labels.get(support_uid, "User"),
        "created_at": row.get("created_at"),
        "last_message_at": row.get("last_message_at"),
        "unread_count": _count_unread_for_admin(row),
    }


def _messages_table_select(client: Any, conversation_id: str, *, limit: int) -> list[dict[str, Any]]:
    """Load message rows; fall back if the metadata column is not migrated yet (027)."""

    def build(cols: str):
        return (
            client.table("messages")
            .select(cols)
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(limit)
        )

    try:
        res = build("id,sender_user_id,body,created_at,metadata").execute()
    except Exception as exc:
        msg = str(exc).lower()
        if "metadata" in msg and ("does not exist" in msg or "42703" in msg):
            logger.warning(
                "chat: messages.metadata missing — run backend/sql/027_message_quote_metadata.sql"
            )
            res = build("id,sender_user_id,body,created_at").execute()
        else:
            raise
    rows = getattr(res, "data", None) or []
    return [r for r in rows if isinstance(r, dict)]


def insert_message(
    *,
    conversation_id: str,
    sender_user_id: str,
    body: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert a message and update conversation last_message_at. No participant checks."""
    text = body.strip()
    if not text:
        raise ValueError("Message cannot be empty.")
    if len(text) > MAX_MESSAGE_LEN:
        raise ValueError(f"Message is too long (max {MAX_MESSAGE_LEN} characters).")

    if get_settings().local_auth_mode:
        return {
            "id": str(uuid4()),
            "sender_user_id": sender_user_id,
            "body": text,
            "created_at": _now_iso(),
            "metadata": metadata,
        }

    client = get_client()
    now = _now_iso()
    payload: dict[str, Any] = {
        "conversation_id": conversation_id,
        "sender_user_id": sender_user_id,
        "body": text,
    }
    if metadata is not None:
        payload["metadata"] = metadata

    try:
        ins = client.table("messages").insert(payload).execute()
    except Exception as e:
        msg = str(e).lower()
        if metadata is not None and "metadata" in msg and ("does not exist" in msg or "42703" in msg):
            payload.pop("metadata", None)
            try:
                ins = client.table("messages").insert(payload).execute()
            except Exception as e2:
                logger.exception("chat: insert message failed")
                raise RuntimeError("Could not send message.") from e2
        else:
            logger.exception("chat: insert message failed")
            raise RuntimeError("Could not send message.") from e

    ins_data = getattr(ins, "data", None) or []
    if not ins_data or not isinstance(ins_data[0], dict):
        raise RuntimeError("Could not send message.")
    msg_row = ins_data[0]
    try:
        client.table("conversations").update({"last_message_at": now}).eq("id", conversation_id).execute()
    except Exception:
        logger.exception("chat: update last_message_at failed")

    return {
        "id": _str_id(msg_row.get("id")),
        "sender_user_id": _str_id(msg_row.get("sender_user_id")),
        "body": str(msg_row.get("body") or text),
        "created_at": msg_row.get("created_at") or now,
        "metadata": metadata if isinstance(metadata, dict) else (
            msg_row.get("metadata") if isinstance(msg_row.get("metadata"), dict) else None
        ),
    }
