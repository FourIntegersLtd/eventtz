"""Problem reports: clients and vendors on a booking can open and view cases."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import apply_recent_first_order, get_db as get_client
from app.features.bookings import _client_emails_by_id, _vendor_display_names_by_id
from app.features.bookings.dispute_commands import create_dispute_case
from app.features.email.dispatch import send_admin_dispute_opened_email
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
    """Use booking.conversation_id when set (e.g. quote sent from chat); otherwise look up by pair."""
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
            .select(_BOOKING_PARTY_SELECT)
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


def _norm_uid(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""
    try:
        return str(uuid.UUID(s)).lower()
    except ValueError:
        return s.lower()


def user_is_booking_party(user_id: str, booking: dict[str, Any]) -> bool:
    cid = _norm_uid(booking.get("client_user_id"))
    vid = _norm_uid(booking.get("vendor_user_id"))
    uid = _norm_uid(user_id)
    return uid == cid or uid == vid


def _ts(v: Any) -> str | None:
    if v is None:
        return None
    return v if isinstance(v, str) else str(v)


def _serialize_public(
    row: dict[str, Any],
    *,
    viewer_role: Literal["client", "vendor"] | None = None,
) -> dict[str, Any]:
    st = str(row.get("status") or "open")
    if st not in ("open", "under_review", "resolved", "closed"):
        st = "open"
    legacy = row.get("resolution_note")
    client_note = row.get("client_resolution_note")
    vendor_note = row.get("vendor_resolution_note")
    if viewer_role == "client":
        rn = client_note if client_note not in (None, "") else legacy
    elif viewer_role == "vendor":
        rn = vendor_note if vendor_note not in (None, "") else legacy
    else:
        # Unknown viewer: prefer party notes if identical, else legacy.
        c = str(client_note).strip() if client_note else ""
        v = str(vendor_note).strip() if vendor_note else ""
        if c and c == v:
            rn = c
        elif c and not v:
            rn = c
        elif v and not c:
            rn = v
        else:
            rn = legacy
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
        "resolution_note": str(rn).strip() if rn and str(rn).strip() else None,
        "chat_included_for_review": bool(conv and str(conv).strip()),
    }


def _same_user_id(a: str, b: str) -> bool:
    na = _norm_uid(a)
    nb = _norm_uid(b)
    return bool(na and nb and na == nb)


_BOOKING_PARTY_SELECT = (
    "id,client_user_id,vendor_user_id,status,conversation_id,event_name,event_date,payment_status"
)


def _index_booking_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Index bookings by raw and normalised id so lookups work regardless of UUID formatting."""
    out: dict[str, dict[str, Any]] = {}
    for b in rows:
        if not isinstance(b, dict) or not b.get("id"):
            continue
        raw = str(b["id"])
        norm = _norm_uid(raw) or raw
        out[raw] = b
        out[norm] = b
    return out


def _lookup_booking(
    bookings: dict[str, dict[str, Any]],
    booking_id: str,
) -> dict[str, Any]:
    if not booking_id:
        return {}
    norm = _norm_uid(booking_id) or booking_id
    found = bookings.get(norm) or bookings.get(booking_id)
    if found:
        return found
    row = _get_booking_row(booking_id)
    return row if row else {}


def _lookup_user_label(labels: dict[str, Any], user_id: str, *, fallback: str) -> str | None:
    if not user_id:
        return None
    norm = _norm_uid(user_id) or user_id
    val = labels.get(user_id) if labels.get(user_id) is not None else labels.get(norm)
    if val is None or (isinstance(val, str) and not val.strip()):
        return fallback
    return str(val).strip() if val else fallback


def _bookings_by_id(booking_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not booking_ids or get_settings().local_auth_mode:
        return {}
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select(_BOOKING_PARTY_SELECT)
            .in_("id", booking_ids)
            .execute()
        )
    except Exception as e:
        logger.warning("_bookings_by_id failed: %s", e, exc_info=True)
        return {}
    return _index_booking_rows([b for b in getattr(res, "data", None) or [] if isinstance(b, dict)])


def _enrich_participant_disputes(
    rows: list[dict[str, Any]],
    viewer_user_id: str,
    *,
    preloaded_bookings: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    if not rows:
        return rows
    booking_ids = list({str(r.get("booking_request_id") or "") for r in rows if r.get("booking_request_id")})
    bookings = dict(preloaded_bookings or {})
    fetched = _bookings_by_id(booking_ids)
    for key, row in fetched.items():
        bookings.setdefault(key, row)

    seen_bookings: set[int] = set()
    party_bookings: list[dict[str, Any]] = []
    for b in bookings.values():
        key = id(b)
        if key in seen_bookings:
            continue
        seen_bookings.add(key)
        party_bookings.append(b)

    vendor_ids = list(
        {str(b.get("vendor_user_id") or "") for b in party_bookings if b.get("vendor_user_id")},
    )
    user_ids: set[str] = set()
    for b in party_bookings:
        cid = str(b.get("client_user_id") or "")
        vid = str(b.get("vendor_user_id") or "")
        if cid:
            user_ids.add(cid)
        if vid:
            user_ids.add(vid)
    for row in rows:
        oid = str(row.get("opened_by_user_id") or "")
        if oid:
            user_ids.add(oid)

    vnames = _vendor_display_names_by_id(vendor_ids) if vendor_ids else {}
    emails = _client_emails_by_id(list(user_ids)) if user_ids else {}

    out: list[dict[str, Any]] = []
    for row in rows:
        bid = str(row.get("booking_request_id") or "")
        booking = _lookup_booking(bookings, bid)
        cid = str(booking.get("client_user_id") or "")
        vid = str(booking.get("vendor_user_id") or "")
        viewer_role: str | None = None
        if _same_user_id(viewer_user_id, cid):
            viewer_role = "client"
        elif _same_user_id(viewer_user_id, vid):
            viewer_role = "vendor"
        base = (
            _serialize_public(row, viewer_role=viewer_role)  # type: ignore[arg-type]
            if "summary" in row
            else dict(row)
        )
        oid = str(base.get("opened_by_user_id") or row.get("opened_by_user_id") or "")

        opened_role: str | None = None
        if _same_user_id(oid, cid):
            opened_role = "client"
        elif _same_user_id(oid, vid):
            opened_role = "vendor"

        client_label = _lookup_user_label(emails, cid, fallback="Client") if cid else None
        vendor_label = _lookup_user_label(vnames, vid, fallback="Vendor") if vid else None

        opened_by_display: str | None = None
        if _same_user_id(oid, viewer_user_id):
            opened_by_display = "You"
        elif opened_role == "client":
            opened_by_display = client_label
        elif opened_role == "vendor":
            opened_by_display = vendor_label
        elif oid:
            opened_by_display = _lookup_user_label(emails, oid, fallback="A party on this booking")

        viewer_uid = _norm_uid(viewer_user_id)
        counterparty_label = vendor_label if viewer_uid == _norm_uid(cid) else client_label

        conv = booking.get("conversation_id") or row.get("conversation_id")
        enriched = {
            **base,
            "event_name": str(booking.get("event_name") or "") or None,
            "event_date": str(booking.get("event_date") or "") or None,
            "booking_status": str(booking.get("status") or "") or None,
            "payment_status": str(booking.get("payment_status") or "") or None,
            "conversation_id": str(conv).strip() if conv and str(conv).strip() else None,
            "opened_by_role": opened_role,
            "opened_by_you": _same_user_id(oid, viewer_user_id),
            "opened_by_display_name": opened_by_display,
            "client_label": client_label,
            "vendor_display_name": vendor_label,
            "counterparty_label": counterparty_label,
        }
        out.append(enriched)
    return out


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
    try:
        send_admin_dispute_opened_email(
            booking_id=booking_id,
            dispute_id=str(row.get("id") or ""),
            summary=summary,
            opened_by_user_id=user_id,
        )
    except Exception:
        logger.warning("admin dispute email failed booking=%s", booking_id, exc_info=True)
    enriched = _enrich_participant_disputes([row], user_id)
    return (enriched[0] if enriched else None), None


def list_disputes_for_participant_user(user_id: str) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    bids = _booking_ids_for_participant(user_id)
    if not bids:
        return []
    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("dispute_cases")
                .select("*")
                .in_("booking_request_id", bids[:500]),
            )
            .limit(200)
            .execute()
        )
    except Exception as e:
        logger.warning("list_disputes_for_participant_user failed: %s", e, exc_info=True)
        return []
    out: list[dict[str, Any]] = []
    for r in getattr(res, "data", None) or []:
        if isinstance(r, dict):
            out.append(r)
    return _enrich_participant_disputes(out, user_id)


def list_disputes_on_booking_for_participant(user_id: str, booking_id: str) -> list[dict[str, Any]]:
    booking = _get_booking_row(booking_id)
    if not booking or not user_is_booking_party(user_id, booking):
        return []
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("dispute_cases")
                .select("*")
                .eq("booking_request_id", booking_id),
            )
            .limit(50)
            .execute()
        )
    except Exception as e:
        logger.warning("list_disputes_on_booking_for_participant failed: %s", e, exc_info=True)
        return []
    out: list[dict[str, Any]] = []
    for r in getattr(res, "data", None) or []:
        if isinstance(r, dict):
            out.append(r)
    preloaded = _index_booking_rows([booking])
    return _enrich_participant_disputes(out, user_id, preloaded_bookings=preloaded)


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
    preloaded = _index_booking_rows([booking])
    enriched = _enrich_participant_disputes([row], user_id, preloaded_bookings=preloaded)
    return enriched[0] if enriched else None
