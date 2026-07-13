"""Client first-visit onboarding state stored on public.users (migration 035)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger

logger = get_logger(__name__)

_DEFAULT_STATE: dict[str, Any] = {"completed": False, "preferred_name": None}

# Cached after first PostgREST 42703 — avoids log spam when migration 035 is not applied yet.
_onboarding_columns_ok: bool | None = None


def _missing_onboarding_columns(err: Exception) -> bool:
    msg = str(err).lower()
    if "does not exist" not in msg and getattr(err, "code", None) != "42703":
        return False
    return "preferred_name" in msg or "client_onboarding_completed_at" in msg


def get_client_onboarding(user_id: str) -> dict[str, Any]:
    """Return {completed: bool, preferred_name: str | None} for a client."""
    global _onboarding_columns_ok
    if get_settings().local_auth_mode or _onboarding_columns_ok is False:
        return dict(_DEFAULT_STATE)
    try:
        res = (
            get_client()
            .table("users")
            .select("preferred_name,client_onboarding_completed_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        _onboarding_columns_ok = True
    except Exception as e:
        if _missing_onboarding_columns(e):
            _onboarding_columns_ok = False
            logger.warning(
                "get_client_onboarding: run backend/sql/035_client_preferred_name.sql — %s", e
            )
            return dict(_DEFAULT_STATE)
        logger.exception("get_client_onboarding failed user_id=%s", user_id)
        return dict(_DEFAULT_STATE)
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return dict(_DEFAULT_STATE)
    row = rows[0]
    pn = row.get("preferred_name")
    return {
        "completed": bool(row.get("client_onboarding_completed_at")),
        "preferred_name": str(pn).strip() if isinstance(pn, str) and pn.strip() else None,
    }


def update_client_onboarding(
    user_id: str,
    *,
    preferred_name: str | None = None,
    mark_completed: bool = False,
) -> dict[str, Any]:
    """Save preferred name and/or mark first-visit onboarding as done."""
    global _onboarding_columns_ok
    if get_settings().local_auth_mode or _onboarding_columns_ok is False:
        return dict(_DEFAULT_STATE)
    patch: dict[str, Any] = {}
    if preferred_name is not None:
        t = preferred_name.strip()
        patch["preferred_name"] = t or None
    if mark_completed:
        patch["client_onboarding_completed_at"] = datetime.now(timezone.utc).isoformat()
    if not patch:
        return get_client_onboarding(user_id)
    try:
        get_client().table("users").update(patch).eq("id", user_id).execute()
    except Exception as e:
        if _missing_onboarding_columns(e):
            _onboarding_columns_ok = False
            logger.warning(
                "update_client_onboarding: run backend/sql/035_client_preferred_name.sql — %s", e
            )
            return dict(_DEFAULT_STATE)
        raise
    return get_client_onboarding(user_id)
