"""Admin review moderation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client

logger = get_logger(__name__)


def set_review_hidden(review_id: str, hidden: bool) -> bool:
    if get_settings().local_auth_mode:
        return False
    ts = datetime.now(timezone.utc).isoformat() if hidden else None
    try:
        get_client().table("booking_reviews").update({"hidden_at": ts}).eq("id", review_id).execute()
        return True
    except Exception as e:
        if "hidden_at" in str(e).lower() or "42703" in str(e):
            logger.warning("set_review_hidden: run migration 018 — %s", e)
            return False
        logger.warning("set_review_hidden failed: %s", e, exc_info=True)
        return False


def list_reviews_for_admin(
    *,
    offset: int = 0,
    limit: int = 100,
) -> tuple[list[dict[str, Any]], int]:
    if get_settings().local_auth_mode:
        return [], 0
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    client = get_client()
    sel = (
        "id,booking_request_id,vendor_user_id,client_user_id,rating,body,hidden_at,created_at"
    )
    try:
        res = (
            client.table("booking_reviews")
            .select(sel, count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as e:
        if "hidden_at" in str(e).lower() or "42703" in str(e):
            sel2 = (
                "id,booking_request_id,vendor_user_id,client_user_id,rating,body,created_at"
            )
            try:
                res = (
                    client.table("booking_reviews")
                    .select(sel2, count="exact")
                    .order("created_at", desc=True)
                    .range(offset, offset + limit - 1)
                    .execute()
                )
            except Exception as e2:
                logger.warning("list_reviews_for_admin failed: %s", e2, exc_info=True)
                return [], 0
        else:
            logger.warning("list_reviews_for_admin failed: %s", e, exc_info=True)
            return [], 0

    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    total = int(getattr(res, "count", None) or len(rows))
    out: list[dict[str, Any]] = []
    for r in rows:
        hid = r.get("hidden_at")
        out.append(
            {
                "id": str(r.get("id", "")),
                "booking_request_id": str(r.get("booking_request_id", "")),
                "vendor_user_id": str(r.get("vendor_user_id", "")),
                "client_user_id": str(r.get("client_user_id", "")),
                "rating": int(r.get("rating") or 0),
                "body": str(r.get("body") or ""),
                "hidden_at": hid if isinstance(hid, str) else None,
                "created_at": r.get("created_at"),
            },
        )
    return out, total
