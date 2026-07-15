"""Read and write rows in the vendors table."""

from __future__ import annotations

from typing import Any

from app.core.db import rows
from app.core.db import get_db


def list_by_user_ids(user_ids: list[str], *, columns: str = "user_id,payload") -> list[dict[str, Any]]:
    if not user_ids:
        return []
    res = get_db().table("vendors").select(columns).in_("user_id", user_ids).execute()
    return rows(res)
