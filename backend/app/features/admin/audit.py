"""Append-only admin audit log (service role)."""

from __future__ import annotations

import json
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client

logger = get_logger(__name__)


def insert_admin_audit_log(
    *,
    admin_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    if get_settings().local_auth_mode:
        return
    try:
        get_client().table("admin_audit_log").insert(
            {
                "admin_user_id": admin_user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "payload": payload or {},
            },
        ).execute()
    except Exception as e:
        # Table may not exist until migration 018 — log only
        err = str(e).lower()
        if "admin_audit_log" in err or "does not exist" in err or "42p01" in err:
            logger.warning("admin_audit_log skipped (migration?): %s", e)
            return
        logger.warning("insert_admin_audit_log failed: %s", e, exc_info=True)


def list_admin_audit_log(*, limit: int = 100, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
    if get_settings().local_auth_mode:
        return [], 0
    try:
        res = (
            get_client()
            .table("admin_audit_log")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + max(limit, 1) - 1)
            .execute()
        )
    except Exception as e:
        logger.warning("list_admin_audit_log failed: %s", e, exc_info=True)
        return [], 0
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    total = int(getattr(res, "count", None) or len(rows))
    out: list[dict[str, Any]] = []
    for r in rows:
        pl = r.get("payload")
        if isinstance(pl, str):
            try:
                pl = json.loads(pl)
            except json.JSONDecodeError:
                pl = {}
        out.append(
            {
                "id": str(r.get("id", "")),
                "admin_user_id": str(r.get("admin_user_id") or ""),
                "action": str(r.get("action", "")),
                "entity_type": str(r.get("entity_type", "")),
                "entity_id": str(r.get("entity_id") or "") if r.get("entity_id") else None,
                "payload": pl if isinstance(pl, dict) else {},
                "created_at": r.get("created_at"),
            },
        )
    return out, total
