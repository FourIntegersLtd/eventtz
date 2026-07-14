"""Admin client account listing and suspension."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.email.dispatch import send_client_suspended_email

logger = get_logger(__name__)


def _booking_counts_for_clients(client_ids: list[str]) -> dict[str, int]:
    if not client_ids:
        return {}
    counts: dict[str, int] = {}
    try:
        br = (
            get_client()
            .table("booking_requests")
            .select("client_user_id")
            .in_("client_user_id", client_ids)
            .execute()
        )
        for x in getattr(br, "data", None) or []:
            if isinstance(x, dict) and x.get("client_user_id"):
                k = str(x["client_user_id"])
                counts[k] = counts.get(k, 0) + 1
    except Exception:
        logger.warning("_booking_counts_for_clients failed", exc_info=True)
    return counts


def _serialize_client_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    uids = [str(r.get("id")) for r in rows if r.get("id")]
    counts = _booking_counts_for_clients(uids)
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


def list_clients_for_admin(
    *,
    offset: int = 0,
    limit: int = 50,
    q: str | None = None,
    suspended: bool | None = None,
) -> tuple[list[dict[str, Any]], int]:
    if get_settings().local_auth_mode:
        return [], 0
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    try:
        query = (
            apply_recent_first_order(
                get_client()
                .table("users")
                .select("id,email,created_at,account_suspended", count="exact")
                .eq("user_type", "client"),
                column="created_at",
            )
        )
        term = (q or "").strip()
        if term:
            query = query.ilike("email", f"%{term}%")
        if suspended is not None:
            query = query.eq("account_suspended", suspended)
        res = query.range(offset, offset + limit - 1).execute()
    except Exception as e:
        if "account_suspended" in str(e).lower() or "42703" in str(e):
            query = (
                apply_recent_first_order(
                    get_client()
                    .table("users")
                    .select("id,email,created_at", count="exact")
                    .eq("user_type", "client"),
                    column="created_at",
                )
            )
            term = (q or "").strip()
            if term:
                query = query.ilike("email", f"%{term}%")
            res = query.range(offset, offset + limit - 1).execute()
        else:
            logger.warning("list_clients_for_admin failed: %s", e, exc_info=True)
            return [], 0

    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    total = int(getattr(res, "count", None) or len(rows))
    return _serialize_client_rows(rows), total


def list_client_user_ids_for_broadcast() -> list[str]:
    """All client user IDs — for admin message fan-out (not paginated directory UI)."""
    if get_settings().local_auth_mode:
        return []
    try:
        res = get_client().table("users").select("id").eq("user_type", "client").execute()
    except Exception as e:
        logger.warning("list_client_user_ids_for_broadcast failed: %s", e, exc_info=True)
        return []
    out: list[str] = []
    for row in getattr(res, "data", None) or []:
        if isinstance(row, dict) and row.get("id"):
            out.append(str(row["id"]))
    return out


def set_client_suspended(user_id: str, suspended: bool) -> bool:
    if get_settings().local_auth_mode:
        return False
    email: str | None = None
    try:
        res = (
            get_client()
            .table("users")
            .select("email")
            .eq("id", user_id)
            .eq("user_type", "client")
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if rows and isinstance(rows[0], dict):
            raw = rows[0].get("email")
            email = str(raw).strip() if raw else None
    except Exception:
        pass
    try:
        get_client().table("users").update({"account_suspended": suspended}).eq(
            "id", user_id
        ).eq("user_type", "client").execute()
        if suspended and email and "@" in email:
            try:
                send_client_suspended_email(email=email)
            except Exception:
                logger.warning("client suspended email failed user=%s", user_id, exc_info=True)
        return True
    except Exception as e:
        if "account_suspended" in str(e).lower() or "42703" in str(e):
            logger.warning("set_client_suspended: run migration 018 — %s", e)
            return False
        logger.warning("set_client_suspended failed: %s", e, exc_info=True)
        return False
