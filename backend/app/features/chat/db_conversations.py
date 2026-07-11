"""Conversations table access."""

from __future__ import annotations

from typing import Any

from app.core.db import one_row, rows
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
        get_db()
        .table("conversations")
        .select(columns)
        .or_(f"client_user_id.eq.{user_id},vendor_user_id.eq.{user_id}")
        .order("updated_at", desc=True)
        .execute()
    )
    return rows(res)
