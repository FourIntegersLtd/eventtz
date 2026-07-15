"""Read and write message rows."""

from __future__ import annotations

from typing import Any

from app.core.db import rows
from app.core.db import get_db


def list_for_conversation(
    conversation_id: str,
    *,
    columns: str,
    limit: int = 200,
) -> list[dict[str, Any]]:
    res = (
        get_db()
        .table("messages")
        .select(columns)
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return rows(res)
