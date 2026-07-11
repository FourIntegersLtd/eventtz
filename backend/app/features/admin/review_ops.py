"""Admin review moderation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.bookings import _client_emails_by_id, _vendor_display_names_by_id

logger = get_logger(__name__)

_REVIEW_SELECT = (
    "id,booking_request_id,vendor_user_id,client_user_id,rating,body,hidden_at,created_at"
)
_REVIEW_SELECT_NO_HIDDEN = (
    "id,booking_request_id,vendor_user_id,client_user_id,rating,body,created_at"
)


def _normalize_review_row(row: dict[str, Any]) -> dict[str, Any]:
    hid = row.get("hidden_at")
    return {
        "id": str(row.get("id", "")),
        "booking_request_id": str(row.get("booking_request_id", "")),
        "vendor_user_id": str(row.get("vendor_user_id", "")),
        "client_user_id": str(row.get("client_user_id", "")),
        "rating": int(row.get("rating") or 0),
        "body": str(row.get("body") or ""),
        "hidden_at": hid if isinstance(hid, str) else None,
        "created_at": row.get("created_at"),
    }


def _enrich_review_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return []
    vendor_ids = list({r["vendor_user_id"] for r in rows if r.get("vendor_user_id")})
    client_ids = list({r["client_user_id"] for r in rows if r.get("client_user_id")})
    vendor_names = _vendor_display_names_by_id(vendor_ids) if vendor_ids else {}
    client_emails = _client_emails_by_id(client_ids) if client_ids else {}
    out: list[dict[str, Any]] = []
    for row in rows:
        vid = row.get("vendor_user_id") or ""
        cid = row.get("client_user_id") or ""
        enriched = {
            **row,
            "vendor_display_name": vendor_names.get(vid, "Vendor"),
            "client_email": client_emails.get(cid),
        }
        out.append(enriched)
    return out


def _attach_booking_context(row: dict[str, Any]) -> dict[str, Any]:
    booking_id = (row.get("booking_request_id") or "").strip()
    if not booking_id:
        return row
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("event_name,event_date,status")
            .eq("id", booking_id)
            .limit(1)
            .execute()
        )
        data = getattr(res, "data", None) or []
        if not data or not isinstance(data[0], dict):
            return row
        booking = data[0]
        return {
            **row,
            "booking_event_name": str(booking.get("event_name") or "") or None,
            "booking_event_date": booking.get("event_date"),
            "booking_status": str(booking.get("status") or "") or None,
        }
    except Exception as e:
        logger.warning("_attach_booking_context failed: %s", e, exc_info=True)
        return row


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
    vendor_user_id: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    if get_settings().local_auth_mode:
        return [], 0
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    client = get_client()

    def _run_query(select: str):
        q = apply_recent_first_order(
            client.table("booking_reviews").select(select, count="exact"),
            column="created_at",
        )
        vid = (vendor_user_id or "").strip()
        if vid:
            q = q.eq("vendor_user_id", vid)
        return q.range(offset, offset + limit - 1).execute()

    try:
        res = _run_query(_REVIEW_SELECT)
    except Exception as e:
        if "hidden_at" in str(e).lower() or "42703" in str(e):
            try:
                res = _run_query(_REVIEW_SELECT_NO_HIDDEN)
            except Exception as e2:
                logger.warning("list_reviews_for_admin failed: %s", e2, exc_info=True)
                return [], 0
        else:
            logger.warning("list_reviews_for_admin failed: %s", e, exc_info=True)
            return [], 0

    rows = [_normalize_review_row(r) for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    total = int(getattr(res, "count", None) or len(rows))
    return _enrich_review_rows(rows), total


def get_review_for_admin(review_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    rid = (review_id or "").strip()
    if not rid:
        return None
    client = get_client()

    def _fetch(select: str) -> dict[str, Any] | None:
        res = client.table("booking_reviews").select(select).eq("id", rid).limit(1).execute()
        data = getattr(res, "data", None) or []
        if not data or not isinstance(data[0], dict):
            return None
        return _normalize_review_row(data[0])

    try:
        row = _fetch(_REVIEW_SELECT)
    except Exception as e:
        if "hidden_at" in str(e).lower() or "42703" in str(e):
            try:
                row = _fetch(_REVIEW_SELECT_NO_HIDDEN)
            except Exception as e2:
                logger.warning("get_review_for_admin failed: %s", e2, exc_info=True)
                return None
        else:
            logger.warning("get_review_for_admin failed: %s", e, exc_info=True)
            return None

    if not row:
        return None
    enriched = _enrich_review_rows([row])[0]
    return _attach_booking_context(enriched)
