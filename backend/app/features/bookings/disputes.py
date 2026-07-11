"""Disputes: participants (client/vendor on booking) can open and view cases."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.bookings.dispute_commands import create_dispute_case
from app.features.realtime.sse import notify_user

logger = get_logger(__name__)

_ACTIVE_STATUSES = frozenset({"open", "under_review"})
_ALLOWED_BOOKING_STATUSES_FOR_NEW_DISPUTE = frozenset(
    {"pending", "accepted", "completed"},
)


def _lookup_conversation_id_for_pair(client_uid: str, vendor_uid: str) -> str | None:
    """Any existing client–vendor DM thread (unique pair in conversations)."""
    if get_settings().local_auth_mode:
        return None
    if not client_uid or not vendor_uid:
        return None
    try:
        res = (
            get_client()
            .table("conversations")
            .select("id")
            .eq("client_user_id", client_uid)
            .eq("vendor_user_id", vendor_uid)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("_lookup_conversation_id_for_pair failed: %s", e, exc_info=True)
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    cid = rows[0].get("id")
    return str(cid) if cid else None


def _resolve_conversation_id_for_dispute(booking: dict[str, Any]) -> str | None:
    """Prefer booking.conversation_id (e.g. quote from chat); else lookup by pair."""
    raw = booking.get("conversation_id")
    if raw is not None and str(raw).strip():
        return str(raw)
    c = str(booking.get("client_user_id") or "")
    v = str(booking.get("vendor_user_id") or "")
    return _lookup_conversation_id_for_pair(c, v)


def _get_booking_row(booking_id: str) -> dict[str, Any] | None:
    try:
        uuid.UUID(booking_id)
    except ValueError:
        return None
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("id,client_user_id,vendor_user_id,status,conversation_id")
            .eq("id", booking_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("_get_booking_row failed: %s", e, exc_info=True)
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]


def user_is_booking_party(user_id: str, booking: dict[str, Any]) -> bool:
    cid = str(booking.get("client_user_id") or "")
    vid = str(booking.get("vendor_user_id") or "")
    return user_id == cid or user_id == vid


def _ts(v: Any) -> str | None:
    if v is None:
        return None
    return v if isinstance(v, str) else str(v)


def _serialize_public(row: dict[str, Any]) -> dict[str, Any]:
    st = str(row.get("status") or "open")
    if st not in ("open", "under_review", "resolved", "closed"):
        st = "open"
    rn = row.get("resolution_note")
    conv = row.get("conversation_id")
    return {
        "id": str(row.get("id", "")),
        "booking_request_id": str(row.get("booking_request_id", "")),
        "opened_by_user_id": str(row.get("opened_by_user_id", "")),
        "status": st,
        "summary": str(row.get("summary", "")),
        "created_at": _ts(row.get("created_at")),
        "updated_at": _ts(row.get("updated_at")),
        "resolved_at": _ts(row.get("resolved_at")),
        "resolution_note": str(rn) if rn else None,
        "chat_included_for_review": bool(conv and str(conv).strip()),
    }


def _booking_ids_for_participant(user_id: str) -> list[str]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("id")
            .or_(f"client_user_id.eq.{user_id},vendor_user_id.eq.{user_id}")
            .limit(2000)
            .execute()
        )
    except Exception as e:
        logger.warning("_booking_ids_for_participant failed: %s", e, exc_info=True)
        return []
    out: list[str] = []
    for r in getattr(res, "data", None) or []:
        if isinstance(r, dict) and r.get("id"):
            out.append(str(r["id"]))
    return out


def has_active_dispute_for_booking(booking_id: str) -> bool:
    if get_settings().local_auth_mode:
        return False
    try:
        res = (
            get_client()
            .table("dispute_cases")
            .select("id")
            .eq("booking_request_id", booking_id)
            .in_("status", list(_ACTIVE_STATUSES))
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("has_active_dispute_for_booking failed: %s", e, exc_info=True)
        return False
    rows = getattr(res, "data", None) or []
    return bool(rows)


def create_dispute_for_participant(
    booking_id: str,
    user_id: str,
    summary: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Returns (public_row, error_code).
    error_code: not_found | forbidden | conflict | invalid_status | server_error
    """
    if get_settings().local_auth_mode:
        return None, "server_error"
    booking = _get_booking_row(booking_id)
    if not booking:
        return None, "not_found"
    if not user_is_booking_party(user_id, booking):
        return None, "forbidden"
    bst = str(booking.get("status") or "")
    if bst not in _ALLOWED_BOOKING_STATUSES_FOR_NEW_DISPUTE:
        return None, "invalid_status"
    if has_active_dispute_for_booking(booking_id):
        return None, "conflict"
    conv_id = _resolve_conversation_id_for_dispute(booking)
    row = create_dispute_case(
        booking_request_id=booking_id,
        opened_by_user_id=user_id,
        summary=summary,
        conversation_id=conv_id,
    )
    if not row:
        if has_active_dispute_for_booking(booking_id):
            return None, "conflict"
        return None, "server_error"
    try:
        cid = str(booking.get("client_user_id") or "")
        vid = str(booking.get("vendor_user_id") or "")
        if cid:
            notify_user(cid, "dispute_changed")
        if vid:
            notify_user(vid, "dispute_changed")
    except Exception:
        logger.warning("dispute_changed notify failed booking=%s", booking_id, exc_info=True)
    return _serialize_public(row), None


def list_disputes_for_participant_user(user_id: str) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    bids = _booking_ids_for_participant(user_id)
    if not bids:
        return []
    try:
        res = (
            get_client()
            .table("dispute_cases")
            .select("*")
            .in_("booking_request_id", bids[:500])
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
    except Exception as e:
        logger.warning("list_disputes_for_participant_user failed: %s", e, exc_info=True)
        return []
    out: list[dict[str, Any]] = []
    for r in getattr(res, "data", None) or []:
        if isinstance(r, dict):
            out.append(_serialize_public(r))
    return out


def list_disputes_on_booking_for_participant(user_id: str, booking_id: str) -> list[dict[str, Any]]:
    booking = _get_booking_row(booking_id)
    if not booking or not user_is_booking_party(user_id, booking):
        return []
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            get_client()
            .table("dispute_cases")
            .select("*")
            .eq("booking_request_id", booking_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
    except Exception as e:
        logger.warning("list_disputes_on_booking_for_participant failed: %s", e, exc_info=True)
        return []
    out: list[dict[str, Any]] = []
    for r in getattr(res, "data", None) or []:
        if isinstance(r, dict):
            out.append(_serialize_public(r))
    return out


def get_dispute_for_participant(dispute_id: str, user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    try:
        uuid.UUID(dispute_id)
    except ValueError:
        return None
    try:
        res = (
            get_client()
            .table("dispute_cases")
            .select("*")
            .eq("id", dispute_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("get_dispute_for_participant fetch failed: %s", e, exc_info=True)
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    bid = str(row.get("booking_request_id") or "")
    booking = _get_booking_row(bid)
    if not booking or not user_is_booking_party(user_id, booking):
        return None
    return _serialize_public(row)
