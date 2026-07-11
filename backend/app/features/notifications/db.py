"""Booking notifications table access."""

from __future__ import annotations

from typing import Any

from app.core.db import rows
from app.core.db import get_db


def list_for_user(user_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    res = (
        get_db()
        .table("booking_notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return rows(res)
