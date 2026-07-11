"""Client–vendor chat: conversations + messages in Supabase."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.errors import ForbiddenError, NotFoundError, ServiceUnavailableError
from app.core.db import get_db as get_client
from app.features.realtime.sse import notify_user
from app.features.auth.lookup import user_emails_by_id, vendor_display_names_by_id

logger = get_logger(__name__)

MAX_MESSAGE_LEN = 5000
LOCAL_CONVERSATION_ID = "00000000-0000-4000-8000-000000000c01"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _str_id(v: Any) -> str:
    return str(v) if v is not None else ""


def _assert_vendor_exists(vendor_user_id: str) -> None:
    if get_settings().local_auth_mode:
        return
    try:
        res = (
            get_client()
            .table("users")
            .select("id,user_type")
            .eq("id", vendor_user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("chat: load user for vendor check failed")
        raise ValueError("Could not verify vendor.") from None
    rows = getattr(res, "data", None) or []
    if not rows:
        raise ValueError("Vendor not found.")
    ut = rows[0].get("user_type") if isinstance(rows[0], dict) else None
    if str(ut) != "vendor":
        raise ValueError("That user is not a vendor account.")
def _role_in_conversation(row: dict[str, Any], user_id: str) -> str | None:
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
    lr = conv.get("client_last_read_at") if role == "client" else conv.get("vendor_last_read_at")
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


def _row_to_conversation_list_item(
    row: dict[str, Any],
    user_id: str,
    peer_names: dict[str, str],
) -> dict[str, Any]:
    c = _str_id(row.get("client_user_id"))
    v = _str_id(row.get("vendor_user_id"))
    is_client = user_id == c
    peer = v if is_client else c
    peer_display = peer_names.get(peer, "Unknown")
    unread = _count_unread_for_user(row, user_id)
    return {
        "id": _str_id(row.get("id")),
        "client_user_id": c,
        "vendor_user_id": v,
        "peer_user_id": peer,
        "peer_display_name": peer_display,
        "created_at": row.get("created_at"),
        "last_message_at": row.get("last_message_at"),
        "unread_count": unread,
    }


def count_unread_chat_total(user_id: str) -> int:
    if get_settings().local_auth_mode:
        return 0
    try:
        res = (
            get_client()
            .table("conversations")
            .select("id,client_user_id,vendor_user_id,client_last_read_at,vendor_last_read_at")
            .or_(f"client_user_id.eq.{user_id},vendor_user_id.eq.{user_id}")
            .execute()
        )
    except Exception:
        logger.exception("chat: list conversations for unread total failed")
        return 0
    rows = getattr(res, "data", None) or []
    if not isinstance(rows, list):
        return 0
    total = 0
    for row in rows:
        if isinstance(row, dict):
            total += _count_unread_for_user(row, user_id)
    return total


def get_or_create_conversation(*, client_user_id: str, vendor_user_id: str) -> dict[str, Any]:
    if client_user_id == vendor_user_id:
        raise ValueError("Cannot start a chat with yourself.")
    _assert_vendor_exists(vendor_user_id)
    if get_settings().local_auth_mode:
        return {
            "id": LOCAL_CONVERSATION_ID,
            "client_user_id": client_user_id,
            "vendor_user_id": vendor_user_id,
            "peer_user_id": vendor_user_id,
            "peer_display_name": "Vendor",
            "created_at": None,
            "last_message_at": None,
            "unread_count": 0,
        }

    client = get_client()
    try:
        existing = (
            client.table("conversations")
            .select("*")
            .eq("client_user_id", client_user_id)
            .eq("vendor_user_id", vendor_user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.exception("chat: get conversation failed")
        raise RuntimeError("Could not load conversation.") from e
    data = getattr(existing, "data", None) or []
    row: dict[str, Any]
    if data and isinstance(data[0], dict):
        row = data[0]
    else:
        try:
            ins = (
                client.table("conversations")
                .insert(
                    {
                        "client_user_id": client_user_id,
                        "vendor_user_id": vendor_user_id,
                    },
                )
                .execute()
            )
        except Exception as e:
            logger.exception("chat: insert conversation failed")
            raise RuntimeError("Could not start conversation.") from e
        ins_data = getattr(ins, "data", None) or []
        if not ins_data or not isinstance(ins_data[0], dict):
            raise RuntimeError("Could not start conversation.")
        row = ins_data[0]

    vnames = vendor_display_names_by_id([vendor_user_id])
    peer_name = vnames.get(vendor_user_id, "Vendor")
    out = _row_to_conversation_list_item(row, client_user_id, {vendor_user_id: peer_name})
    return out


def list_conversations_for_user(user_id: str, *, role: str) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            get_client()
            .table("conversations")
            .select("*")
            .or_(f"client_user_id.eq.{user_id},vendor_user_id.eq.{user_id}")
            .order("last_message_at", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception:
        logger.exception("chat: list conversations failed")
        return []
    rows = getattr(res, "data", None) or []
    if not isinstance(rows, list):
        return []

    vendor_ids: list[str] = []
    client_ids: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        vendor_ids.append(_str_id(row.get("vendor_user_id")))
        client_ids.append(_str_id(row.get("client_user_id")))

    vnames = vendor_display_names_by_id(list({i for i in vendor_ids if i}))
    emails = user_emails_by_id(list({i for i in client_ids if i}))

    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        c = _str_id(row.get("client_user_id"))
        v = _str_id(row.get("vendor_user_id"))
        is_client = user_id == c
        peer = v if is_client else c
        if is_client:
            peer_names = {peer: vnames.get(peer, "Vendor")}
        else:
            peer_names = {peer: emails.get(peer, "Client")}
        out.append(_row_to_conversation_list_item(row, user_id, peer_names))
    return out


def get_conversation_for_user(conversation_id: str, user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        if conversation_id != LOCAL_CONVERSATION_ID:
            return None
        # Dev-only stub: treat current user as client talking to a placeholder vendor.
        vid = "00000000-0000-4000-8000-0000000000e01"
        return {
            "id": LOCAL_CONVERSATION_ID,
            "client_user_id": user_id,
            "vendor_user_id": vid,
            "peer_user_id": vid,
            "peer_display_name": "Vendor (local)",
            "created_at": None,
            "last_message_at": None,
            "unread_count": 0,
        }
    try:
        res = (
            get_client()
            .table("conversations")
            .select("*")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("chat: get conversation by id failed")
        return None
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    row = data[0]
    role = _role_in_conversation(row, user_id)
    if not role:
        return None
    c = _str_id(row.get("client_user_id"))
    v = _str_id(row.get("vendor_user_id"))
    peer = v if user_id == c else c
    if user_id == c:
        peer_names = vendor_display_names_by_id([v])
        pname = peer_names.get(v, "Vendor")
    else:
        peer_names = user_emails_by_id([c])
        pname = peer_names.get(c, "Client")
    return _row_to_conversation_list_item(row, user_id, {peer: pname})


def _messages_table_select(client: Any, conversation_id: str, *, limit: int) -> list[dict[str, Any]]:
    """Load message rows; fall back if `metadata` column is not migrated yet (027)."""
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


def list_messages_for_user(
    conversation_id: str,
    user_id: str,
    *,
    limit: int = 100,
) -> list[dict[str, Any]]:
    lim = max(1, min(limit, 200))
    if get_settings().local_auth_mode:
        if conversation_id != LOCAL_CONVERSATION_ID:
            return []
        return []

    conv = None
    try:
        res = (
            get_client()
            .table("conversations")
            .select("id,client_user_id,vendor_user_id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
        d = getattr(res, "data", None) or []
        conv = d[0] if d and isinstance(d[0], dict) else None
    except Exception:
        logger.exception("chat: load conv for messages failed")
        return []

    if not conv or _role_in_conversation(conv, user_id) is None:
        return []

    try:
        rows = _messages_table_select(get_client(), conversation_id, limit=lim)
    except Exception:
        logger.exception("chat: list messages failed")
        return []
    rows = list(reversed(rows))
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
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


def send_message(*, conversation_id: str, sender_user_id: str, body: str) -> dict[str, Any]:
    text = body.strip()
    if not text:
        raise ValueError("Message cannot be empty.")
    if len(text) > MAX_MESSAGE_LEN:
        raise ValueError(f"Message is too long (max {MAX_MESSAGE_LEN} characters).")

    if get_settings().local_auth_mode:
        if conversation_id != LOCAL_CONVERSATION_ID:
            raise ValueError("Conversation not found.")
        return {
            "id": "00000000-0000-4000-8000-000000000d01",
            "sender_user_id": sender_user_id,
            "body": text,
            "created_at": _now_iso(),
        }

    client = get_client()
    try:
        res = (
            client.table("conversations")
            .select("id,client_user_id,vendor_user_id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.exception("chat: send load conv failed")
        raise RuntimeError("Could not send message.") from e
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise ValueError("Conversation not found.")
    conv = data[0]
    role = _role_in_conversation(conv, sender_user_id)
    if not role:
        raise ValueError("You are not part of this conversation.")

    now = _now_iso()
    try:
        ins = (
            client.table("messages")
            .insert(
                {
                    "conversation_id": conversation_id,
                    "sender_user_id": sender_user_id,
                    "body": text,
                },
            )
            .execute()
        )
    except Exception as e:
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
    }


def send_quote_message(
    *,
    conversation_id: str,
    sender_user_id: str,
    recipient_user_id: str | None,
    booking_request_id: str,
    event_name: str,
    total_label: str,
) -> None:
    """Insert a system "quote sent" card into the thread so both parties can see and
    open it inline, instead of the quote only existing in Bookings. Best-effort: a
    failure here must never block quote creation itself.
    """
    if get_settings().local_auth_mode:
        return
    fallback_body = f"Sent a custom quote — {event_name} ({total_label})"
    metadata = {
        "kind": "quote",
        "booking_request_id": booking_request_id,
        "event_name": event_name,
        "total_label": total_label,
    }
    try:
        get_client().table("messages").insert(
            {
                "conversation_id": conversation_id,
                "sender_user_id": sender_user_id,
                "body": fallback_body,
                "metadata": metadata,
            },
        ).execute()
    except Exception as exc:
        msg = str(exc).lower()
        if "metadata" in msg and ("does not exist" in msg or "42703" in msg):
            get_client().table("messages").insert(
                {
                    "conversation_id": conversation_id,
                    "sender_user_id": sender_user_id,
                    "body": fallback_body,
                },
            ).execute()
        else:
            raise
    try:
        get_client().table("conversations").update(
            {"last_message_at": _now_iso()},
        ).eq("id", conversation_id).execute()
        notify_user(sender_user_id, "chat_unread_changed")
        if recipient_user_id:
            notify_user(recipient_user_id, "chat_unread_changed")
    except Exception:
        logger.exception("chat: send quote card message failed conv=%s", conversation_id)


def mark_conversation_read(conversation_id: str, user_id: str) -> None:
    if get_settings().local_auth_mode:
        return
    client = get_client()
    try:
        res = (
            client.table("conversations")
            .select("id,client_user_id,vendor_user_id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.exception("chat: mark read load conv failed")
        raise ServiceUnavailableError("Could not update read state.") from e
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise NotFoundError("Conversation not found.")
    conv = data[0]
    role = _role_in_conversation(conv, user_id)
    if not role:
        raise ForbiddenError("You are not part of this conversation.")

    now = _now_iso()
    field = "client_last_read_at" if role == "client" else "vendor_last_read_at"
    try:
        client.table("conversations").update({field: now}).eq("id", conversation_id).execute()
    except Exception as e:
        logger.exception("chat: mark read update failed")
        raise ServiceUnavailableError("Could not update read state.") from e


def assert_conversation_matches_pair(
    *,
    conversation_id: str,
    client_user_id: str,
    vendor_user_id: str,
) -> None:
    """Raise ValueError if the conversation does not link exactly this client and vendor."""
    if get_settings().local_auth_mode:
        if conversation_id != LOCAL_CONVERSATION_ID:
            raise ValueError("Conversation not found.")
        return
    try:
        res = (
            get_client()
            .table("conversations")
            .select("id,client_user_id,vendor_user_id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("chat: assert conversation pair failed")
        raise ValueError("Could not verify conversation.") from None
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise ValueError("Conversation not found.")
    row = data[0]
    c = _str_id(row.get("client_user_id"))
    v = _str_id(row.get("vendor_user_id"))
    if c != client_user_id or v != vendor_user_id:
        raise ValueError("Conversation does not match this client and vendor.")
