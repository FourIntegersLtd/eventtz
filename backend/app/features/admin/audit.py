"""Write-only admin audit log (uses full database access)."""

from __future__ import annotations

import json
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client

logger = get_logger(__name__)


def _normalize_audit_row(row: dict[str, Any]) -> dict[str, Any]:
    pl = row.get("payload")
    if isinstance(pl, str):
        try:
            pl = json.loads(pl)
        except json.JSONDecodeError:
            pl = {}
    return {
        "id": str(row.get("id", "")),
        "admin_user_id": str(row.get("admin_user_id") or "") or None,
        "action": str(row.get("action", "")),
        "entity_type": str(row.get("entity_type", "")),
        "entity_id": str(row.get("entity_id") or "") if row.get("entity_id") else None,
        "payload": pl if isinstance(pl, dict) else {},
        "created_at": row.get("created_at"),
    }


def _attach_admin_emails(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return rows
    from app.features.auth.accounts import fetch_user_profile

    admin_ids = {str(r["admin_user_id"]) for r in rows if r.get("admin_user_id")}
    emails: dict[str, str | None] = {}
    for uid in admin_ids:
        prof = fetch_user_profile(uid)
        emails[uid] = str(prof.get("email") or "") if prof else None
    out: list[dict[str, Any]] = []
    for r in rows:
        item = dict(r)
        aid = item.get("admin_user_id")
        item["admin_email"] = emails.get(str(aid)) if aid else None
        out.append(item)
    return out


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


def list_admin_audit_log(
    *,
    limit: int = 100,
    offset: int = 0,
    category: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    if get_settings().local_auth_mode:
        return [], 0
    cat = (category or "all").strip().lower()
    # Category filters match the frontend auditFormatters CATEGORY_BY_ACTION.
    category_prefixes: dict[str, tuple[str, ...]] = {
        "bookings": ("booking.",),
        "clients": ("client.",),
        "vendors": ("vendor.",),
        "disputes": ("dispute.",),
        "reviews": ("review.",),
        "chat": ("chat.",),
        "financials": ("financials.",),
        "team": ("admin.team",),
    }
    try:
        q = apply_recent_first_order(
            get_client().table("admin_audit_log").select("*", count="exact"),
            column="created_at",
        )
        prefixes = category_prefixes.get(cat)
        if prefixes:
            # Filter by action prefix, e.g. action.like.booking.*,action.like.client.*
            or_parts = [f"action.like.{p}%" for p in prefixes]
            q = q.or_(",".join(or_parts))
        elif cat not in ("", "all"):
            # Unknown category → empty
            return [], 0
        res = q.range(offset, offset + max(limit, 1) - 1).execute()
    except Exception as e:
        logger.warning("list_admin_audit_log failed: %s", e, exc_info=True)
        return [], 0
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    total = int(getattr(res, "count", None) or len(rows))
    out = _attach_admin_emails([_normalize_audit_row(r) for r in rows])
    return out, total


def get_admin_audit_log_entry(entry_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    try:
        res = (
            get_client()
            .table("admin_audit_log")
            .select("*")
            .eq("id", entry_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("get_admin_audit_log_entry failed: %s", e, exc_info=True)
        return None
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    if not rows:
        return None
    enriched = _attach_admin_emails([_normalize_audit_row(rows[0])])
    return enriched[0] if enriched else None
