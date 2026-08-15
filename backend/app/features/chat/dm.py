"""Client-vendor DM conversation logic and user-facing chat inbox."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.errors import ForbiddenError, NotFoundError, ServiceUnavailableError
from app.core.db import apply_recent_first_order, get_db
from app.features.auth.user_vendor_display_lookup import (
    client_display_names_by_id,
    user_types_by_id,
    vendor_display_names_by_id,
)
from app.features.realtime.sse import notify_user

from app.features.chat import messages as chat_messages
from app.features.chat.chat_formatting_and_ids import (
    ADMIN_SENDER_DISPLAY,
    ADMIN_SENDER_USER_ID,
    MAX_MESSAGE_LEN,
    _conversation_kind,
    _count_unread_for_user,
    _messages_table_select,
    _now_iso,
    _role_in_conversation,
    _row_to_conversation_list_item,
    _str_id,
    insert_message,
)

logger = get_logger(__name__)


def _client_peer_labels(client_ids: list[str]) -> dict[str, str]:
    """Vendor-facing labels for client peers; never expose admin personal emails."""
    unique = list({cid for cid in client_ids if cid})
    if not unique:
        return {}
    types = user_types_by_id(unique)
    names = client_display_names_by_id(unique)
    out: dict[str, str] = {}
    for uid in unique:
        if types.get(uid) == "admin":
            out[uid] = ADMIN_SENDER_DISPLAY
        else:
            out[uid] = names.get(uid, chat_messages.CLIENT_DISPLAY_FALLBACK)
    return out


def _assert_vendor_exists(vendor_user_id: str) -> None:
    try:
        res = (
            get_db()
            .table("users")
            .select("id,user_type")
            .eq("id", vendor_user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("chat: load user for vendor check failed")
        raise ValueError(chat_messages.VENDOR_VERIFY_FAILED) from None
    rows = getattr(res, "data", None) or []
    if not rows:
        raise ValueError(chat_messages.VENDOR_NOT_FOUND)
    ut = rows[0].get("user_type") if isinstance(rows[0], dict) else None
    if str(ut) != "vendor":
        raise ValueError(chat_messages.NOT_VENDOR_ACCOUNT)


def count_unread_chat_total(user_id: str) -> int:
    try:
        res = (
            get_db()
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
        raise ValueError(chat_messages.SELF_CHAT_FORBIDDEN)
    _assert_vendor_exists(vendor_user_id)
    if require_bookable_vendor:
        from app.features.vendors.moderation import vendor_is_bookable_for_explore

        if not vendor_is_bookable_for_explore(vendor_user_id):
            raise ValueError(chat_messages.VENDOR_UNAVAILABLE)
    client = get_db()
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
            raise RuntimeError(chat_messages.CONVERSATION_LOAD_FAILED) from e2
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
                raise RuntimeError(chat_messages.CONVERSATION_START_FAILED) from e
        ins_data = getattr(ins, "data", None) or []
        if not ins_data or not isinstance(ins_data[0], dict):
            raise RuntimeError(chat_messages.CONVERSATION_START_FAILED)
        row = ins_data[0]

    vnames = vendor_display_names_by_id([vendor_user_id])
    peer_name = vnames.get(vendor_user_id, chat_messages.VENDOR_DISPLAY_FALLBACK)
    out = _row_to_conversation_list_item(row, client_user_id, {vendor_user_id: peer_name})
    return out


def list_conversations_for_user(user_id: str, *, role: str) -> list[dict[str, Any]]:
    try:
        res = (
            apply_recent_first_order(
                get_db()
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
    client_labels = _client_peer_labels(list({i for i in client_ids if i}))

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
            peer_names = {peer: vnames.get(peer, chat_messages.VENDOR_DISPLAY_FALLBACK)}
        else:
            peer_names = {peer: client_labels.get(peer, chat_messages.CLIENT_DISPLAY_FALLBACK)}
        out.append(_row_to_conversation_list_item(row, user_id, peer_names))
    _ = role  # role kept for call-site clarity (client vs vendor portal)
    return out


def get_conversation_for_user(conversation_id: str, user_id: str) -> dict[str, Any] | None:
    try:
        res = (
            get_db()
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
        pname = peer_names.get(v, chat_messages.VENDOR_DISPLAY_FALLBACK)
    else:
        peer_names = _client_peer_labels([c])
        pname = peer_names.get(c, chat_messages.CLIENT_DISPLAY_FALLBACK)
    return _row_to_conversation_list_item(row, user_id, {peer: pname})


def list_messages_for_user(
    conversation_id: str,
    user_id: str,
    *,
    limit: int = 100,
) -> list[dict[str, Any]]:
    lim = max(1, min(limit, 200))
    conv = None
    try:
        res = (
            get_db()
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
        rows = _messages_table_select(get_db(), conversation_id, limit=lim)
    except Exception:
        logger.exception("chat: list messages failed")
        return []
    rows = list(reversed(rows))
    is_support = _conversation_kind(conv) == "support"
    support_uid = _str_id(conv.get("support_user_id")) if is_support else ""
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        metadata = row.get("metadata")
        sender = _str_id(row.get("sender_user_id"))
        item: dict[str, Any] = {
            "id": _str_id(row.get("id")),
            "sender_user_id": sender,
            "body": str(row.get("body") or ""),
            "created_at": row.get("created_at"),
            "metadata": metadata if isinstance(metadata, dict) else None,
        }
        if is_support and support_uid and sender != support_uid:
            item["sender_user_id"] = ADMIN_SENDER_USER_ID
            item["sender_display_name"] = ADMIN_SENDER_DISPLAY
        out.append(item)
    return out


def send_message(*, conversation_id: str, sender_user_id: str, body: str) -> dict[str, Any]:
    text = body.strip()
    if not text:
        raise ValueError(chat_messages.MESSAGE_EMPTY)
    if len(text) > MAX_MESSAGE_LEN:
        raise ValueError(chat_messages.message_too_long_detail(MAX_MESSAGE_LEN))

    client = get_db()
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
        raise RuntimeError(chat_messages.SEND_MESSAGE_FAILED) from e
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise ValueError(chat_messages.CONVERSATION_NOT_FOUND)
    conv = data[0]
    role = _role_in_conversation(conv, sender_user_id)
    if not role:
        raise ValueError(chat_messages.NOT_IN_CONVERSATION)

    msg = insert_message(
        conversation_id=conversation_id,
        sender_user_id=sender_user_id,
        body=text,
    )
    _maybe_mark_vendor_first_response_from_chat(
        conversation_id=conversation_id,
        sender_user_id=sender_user_id,
        conv=conv,
    )
    return msg


def _maybe_mark_vendor_first_response_from_chat(
    *,
    conversation_id: str,
    sender_user_id: str,
    conv: dict[str, Any],
) -> None:
    vendor_uid = str(conv.get("vendor_user_id") or "")
    if not vendor_uid or sender_user_id != vendor_uid:
        return
    if str(conv.get("kind") or "dm") != "dm":
        return
    try:
        from app.features.bookings.booking_funnel_timestamps import mark_vendor_first_response
        from app.features.analytics.events import record_marketplace_event

        client = get_db()
        res = (
            client.table("booking_requests")
            .select("id,created_at,status")
            .eq("conversation_id", conversation_id)
            .eq("vendor_user_id", vendor_uid)
            .in_("status", ["pending", "accepted", "declined"])
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        for row in getattr(res, "data", None) or []:
            if not isinstance(row, dict):
                continue
            bid = str(row.get("id") or "")
            if not bid:
                continue
            mark_vendor_first_response(bid, created_at=row.get("created_at"))
            record_marketplace_event(
                "vendor_message_sent",
                actor_user_id=sender_user_id,
                vendor_user_id=vendor_uid,
                booking_request_id=bid,
            )
            break
    except Exception:
        logger.exception("chat: first-response funnel mark failed")


def send_quote_message(
    *,
    conversation_id: str,
    sender_user_id: str,
    recipient_user_id: str | None,
    booking_request_id: str,
    event_name: str,
    total_label: str,
) -> None:
    """Add a system "quote sent" card to the thread. Best-effort."""
    fallback_body = chat_messages.quote_sent_body(event_name, total_label)
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
    client = get_db()
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
        raise ServiceUnavailableError(chat_messages.READ_STATE_UPDATE_FAILED) from e
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise NotFoundError(chat_messages.CONVERSATION_NOT_FOUND)
    conv = data[0]
    role = _role_in_conversation(conv, user_id)
    if not role:
        raise ForbiddenError(chat_messages.NOT_IN_CONVERSATION)

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
        raise ServiceUnavailableError(chat_messages.READ_STATE_UPDATE_FAILED) from e


def assert_conversation_matches_pair(
    *,
    conversation_id: str,
    client_user_id: str,
    vendor_user_id: str,
) -> None:
    """Raise ValueError if the conversation does not link exactly this client and vendor."""
    try:
        res = (
            get_db()
            .table("conversations")
            .select("id,kind,client_user_id,vendor_user_id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("chat: assert conversation pair failed")
        raise ValueError(chat_messages.CONVERSATION_VERIFY_FAILED) from None
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise ValueError(chat_messages.CONVERSATION_NOT_FOUND)
    row = data[0]
    if _conversation_kind(row) != "dm":
        raise ValueError(chat_messages.BOOKING_CONVERSATION_MISMATCH)
    c = _str_id(row.get("client_user_id"))
    v = _str_id(row.get("vendor_user_id"))
    if c != client_user_id or v != vendor_user_id:
        raise ValueError(chat_messages.BOOKING_CONVERSATION_MISMATCH)
