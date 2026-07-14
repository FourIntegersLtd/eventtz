"""Client–vendor chat and Eventtz Support threads (conversations + messages)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.errors import ForbiddenError, NotFoundError, ServiceUnavailableError
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.realtime.sse import notify_user
from app.features.auth.lookup import user_emails_by_id, vendor_display_names_by_id

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
        # Reuse client_last_read_at as the end-user cursor on support threads.
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


def count_unread_chat_total(user_id: str) -> int:
    if get_settings().local_auth_mode:
        return 0
    try:
        res = (
            get_client()
            .table("conversations")
            .select(
                "id,kind,client_user_id,vendor_user_id,support_user_id,"
                "client_last_read_at,vendor_last_read_at",
            )
            .or_(
                f"client_user_id.eq.{user_id},vendor_user_id.eq.{user_id},"
                f"support_user_id.eq.{user_id}",
            )
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


def get_or_create_conversation(
    *,
    client_user_id: str,
    vendor_user_id: str,
    require_bookable_vendor: bool = True,
) -> dict[str, Any]:
    if client_user_id == vendor_user_id:
        raise ValueError("Cannot start a chat with yourself.")
    _assert_vendor_exists(vendor_user_id)
    if require_bookable_vendor:
        from app.features.vendors.moderation import vendor_is_bookable_for_explore

        if not vendor_is_bookable_for_explore(vendor_user_id):
            raise ValueError("This vendor is not available for messages.")
    if get_settings().local_auth_mode:
        return {
            "id": LOCAL_CONVERSATION_ID,
            "kind": "dm",
            "support_user_id": None,
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
            .eq("kind", "dm")
            .eq("client_user_id", client_user_id)
            .eq("vendor_user_id", vendor_user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        # Pre-migration 038 may lack `kind`.
        try:
            existing = (
                client.table("conversations")
                .select("*")
                .eq("client_user_id", client_user_id)
                .eq("vendor_user_id", vendor_user_id)
                .limit(1)
                .execute()
            )
        except Exception as e2:
            logger.exception("chat: get conversation failed")
            raise RuntimeError("Could not load conversation.") from e2
        _ = e
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
                        "kind": "dm",
                        "client_user_id": client_user_id,
                        "vendor_user_id": vendor_user_id,
                    },
                )
                .execute()
            )
        except Exception as e:
            msg = str(e).lower()
            if "kind" in msg and ("does not exist" in msg or "42703" in msg):
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
            else:
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


def get_or_create_support_conversation(user_id: str) -> dict[str, Any]:
    """One Eventtz Support thread per end user (client or vendor)."""
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("User id is required.")
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


def list_conversations_for_user(user_id: str, *, role: str) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("conversations")
                .select("*")
                .or_(
                    f"client_user_id.eq.{user_id},vendor_user_id.eq.{user_id},"
                    f"support_user_id.eq.{user_id}",
                ),
                column="last_message_at",
                tie_breaker="created_at",
            )
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
        if _conversation_kind(row) == "support":
            continue
        vendor_ids.append(_str_id(row.get("vendor_user_id")))
        client_ids.append(_str_id(row.get("client_user_id")))

    vnames = vendor_display_names_by_id(list({i for i in vendor_ids if i}))
    emails = user_emails_by_id(list({i for i in client_ids if i}))

    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if _conversation_kind(row) == "support":
            out.append(_row_to_conversation_list_item(row, user_id, {}))
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
    _ = role  # role kept for call-site clarity (client vs vendor portal)
    return out


def get_conversation_for_user(conversation_id: str, user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        if conversation_id != LOCAL_CONVERSATION_ID:
            return None
        vid = "00000000-0000-4000-8000-0000000000e01"
        return {
            "id": LOCAL_CONVERSATION_ID,
            "kind": "dm",
            "support_user_id": None,
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
    if _conversation_kind(row) == "support":
        return _row_to_conversation_list_item(row, user_id, {})
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
            .select("id,kind,client_user_id,vendor_user_id,support_user_id")
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


def insert_message(
    *,
    conversation_id: str,
    sender_user_id: str,
    body: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert a message and bump conversation last_message_at. No participant checks."""
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
            "metadata": None,
        }

    client = get_client()
    try:
        res = (
            client.table("conversations")
            .select("id,kind,client_user_id,vendor_user_id,support_user_id")
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

    return insert_message(
        conversation_id=conversation_id,
        sender_user_id=sender_user_id,
        body=text,
    )


def admin_send_support_message(
    *,
    admin_user_id: str,
    recipient_user_ids: list[str],
    body: str,
) -> dict[str, Any]:
    """Fan-out: one support thread per recipient. Returns sent count + conversation ids."""
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


def send_quote_message(
    *,
    conversation_id: str,
    sender_user_id: str,
    recipient_user_id: str | None,
    booking_request_id: str,
    event_name: str,
    total_label: str,
) -> None:
    """Insert a system "quote sent" card into the thread. Best-effort."""
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
        insert_message(
            conversation_id=conversation_id,
            sender_user_id=sender_user_id,
            body=fallback_body,
            metadata=metadata,
        )
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
            .select("id,kind,client_user_id,vendor_user_id,support_user_id")
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
    if role == "support_user":
        field = "client_last_read_at"
    elif role == "client":
        field = "client_last_read_at"
    else:
        field = "vendor_last_read_at"
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
            .select("id,kind,client_user_id,vendor_user_id")
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
    if _conversation_kind(row) != "dm":
        raise ValueError("Conversation does not match this client and vendor.")
    c = _str_id(row.get("client_user_id"))
    v = _str_id(row.get("vendor_user_id"))
    if c != client_user_id or v != vendor_user_id:
        raise ValueError("Conversation does not match this client and vendor.")
