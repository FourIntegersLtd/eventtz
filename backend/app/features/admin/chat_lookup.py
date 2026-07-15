"""Admin chat thread metadata and message history."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.auth.lookup import user_emails_by_id, vendor_display_names_by_id

logger = get_logger(__name__)


def get_conversation_admin_meta(conversation_id: str) -> dict[str, Any]:
    """Participants and labels for the admin chat viewer (same threads as the client/vendor UI)."""
    empty: dict[str, Any] = {
        "client_user_id": None,
        "vendor_user_id": None,
        "client_email": None,
        "vendor_display_name": None,
    }
    if get_settings().local_auth_mode:
        return empty
    try:
        uuid.UUID(conversation_id)
    except ValueError:
        return empty
    try:
        res = (
            get_client()
            .table("conversations")
            .select("id,client_user_id,vendor_user_id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("get_conversation_admin_meta failed: %s", e, exc_info=True)
        return empty
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return empty
    row = rows[0]
    cid = str(row.get("client_user_id") or "")
    vid = str(row.get("vendor_user_id") or "")
    if not cid or not vid:
        return empty
    emails = user_emails_by_id([cid])
    vnames = vendor_display_names_by_id([vid])
    return {
        "client_user_id": cid,
        "vendor_user_id": vid,
        "client_email": emails.get(cid),
        "vendor_display_name": vnames.get(vid),
    }


def get_conversation_messages_admin(conversation_id: str) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    try:
        uuid.UUID(conversation_id)
    except ValueError:
        return []
    try:
        res = (
            get_client()
            .table("messages")
            .select("id,sender_user_id,body,created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .limit(500)
            .execute()
        )
    except Exception as e:
        logger.warning("get_conversation_messages_admin failed: %s", e, exc_info=True)
        return []
    out = []
    for r in getattr(res, "data", None) or []:
        if not isinstance(r, dict):
            continue
        out.append(
            {
                "id": str(r.get("id", "")),
                "sender_user_id": str(r.get("sender_user_id", "")),
                "body": str(r.get("body", "")),
                "created_at": r.get("created_at"),
            },
        )
    return out
