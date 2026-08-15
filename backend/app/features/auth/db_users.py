"""Read and write rows in the users table."""

from __future__ import annotations

from typing import Any

from app.core.db import get_db, rows_from_query_result


def list_by_ids(user_ids: list[str], *, columns: str = "id,email,user_type") -> list[dict[str, Any]]:
    if not user_ids:
        return []
    res = get_db().table("users").select(columns).in_("id", user_ids).execute()
    return rows_from_query_result(res)


def get_user_by_id(user_id: str, *, columns: str = "id,email,user_type") -> dict[str, Any] | None:
    res = get_db().table("users").select(columns).eq("id", user_id).limit(1).execute()
    items = rows_from_query_result(res)
    return items[0] if items else None
