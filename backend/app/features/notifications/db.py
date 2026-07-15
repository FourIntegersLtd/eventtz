"""Read and write booking notification rows."""

from __future__ import annotations

from typing import Any

from app.core.db import apply_recent_first_order, rows
from app.core.db import get_db


def list_for_user(user_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    res = (
        apply_recent_first_order(
            get_db()
            .table("booking_notifications")
            .select("*")
            .eq("user_id", user_id),
            column="created_at",
        )
        .limit(limit)
        .execute()
    )
    return rows(res)
