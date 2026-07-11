"""Admin client account listing and suspension."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client

logger = get_logger(__name__)


def list_clients_for_admin() -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("users")
                .select("id,email,created_at,account_suspended")
                .eq("user_type", "client"),
                column="created_at",
            )
            .limit(2000)
            .execute()
        )
    except Exception as e:
        if "account_suspended" in str(e).lower() or "42703" in str(e):
            res = (
                apply_recent_first_order(
                    get_client()
                    .table("users")
                    .select("id,email,created_at")
                    .eq("user_type", "client"),
                    column="created_at",
                )
                .limit(2000)
                .execute()
            )
        else:
            logger.warning("list_clients_for_admin failed: %s", e, exc_info=True)
            return []

    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    uids = [str(r.get("id")) for r in rows if r.get("id")]
    counts: dict[str, int] = {}
    if uids:
        try:
            br = (
                get_client()
                .table("booking_requests")
                .select("client_user_id")
                .in_("client_user_id", uids[:500])
                .execute()
            )
            for x in getattr(br, "data", None) or []:
                if isinstance(x, dict) and x.get("client_user_id"):
                    k = str(x["client_user_id"])
                    counts[k] = counts.get(k, 0) + 1
        except Exception:
            pass

    out: list[dict[str, Any]] = []
    for r in rows:
        uid = str(r.get("id", ""))
        out.append(
            {
                "user_id": uid,
                "email": r.get("email"),
                "created_at": r.get("created_at"),
                "account_suspended": bool(r.get("account_suspended", False)),
                "booking_count": counts.get(uid, 0),
            },
        )
    return out


def set_client_suspended(user_id: str, suspended: bool) -> bool:
    if get_settings().local_auth_mode:
        return False
    try:
        get_client().table("users").update({"account_suspended": suspended}).eq(
            "id", user_id
        ).eq("user_type", "client").execute()
        return True
    except Exception as e:
        if "account_suspended" in str(e).lower() or "42703" in str(e):
            logger.warning("set_client_suspended: run migration 018 — %s", e)
            return False
        logger.warning("set_client_suspended failed: %s", e, exc_info=True)
        return False
