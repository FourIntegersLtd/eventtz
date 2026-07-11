"""Conversations table access."""

from __future__ import annotations

from typing import Any

from app.core.db import apply_recent_first_order, one_row, rows
from app.core.db import get_db


def get_by_id(conversation_id: str, *, columns: str = "*") -> dict[str, Any] | None:
    res = (
        get_db()
        .table("conversations")
        .select(columns)
        .eq("id", conversation_id)
        .limit(1)
        .execute()
    )
    return one_row(res)


def list_for_user(user_id: str, *, columns: str = "*") -> list[dict[str, Any]]:
    res = (
        apply_recent_first_order(
            get_db()
            .table("conversations")
            .select(columns)
            .or_(f"client_user_id.eq.{user_id},vendor_user_id.eq.{user_id}"),
            column="last_message_at",
            tie_breaker="created_at",
        )
        .execute()
    )
    return rows(res)
