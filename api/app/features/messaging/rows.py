"""Typed rows the messaging repositories return, in the plain shape of `core.db.plain_row`.

Ids are text and timestamps ISO text, as the baseline's PostgREST rows were.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ThreadRow(BaseModel):
    """One `conversations` row: a DM (client and vendor set) or a support thread (support user set)."""

    id: str
    kind: str = "dm"
    client_user_id: str | None = None
    vendor_user_id: str | None = None
    support_user_id: str | None = None
    created_at: str | None = None
    last_message_at: str | None = None


class StoredMessageRow(BaseModel):
    """One `messages` row."""

    id: str
    conversation_id: str
    sender_user_id: str
    body: str
    created_at: str | None = None
    metadata: dict[str, Any] | None = None
