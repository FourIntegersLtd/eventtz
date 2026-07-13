"""Contact-sharing preferences stored on public.users."""

from __future__ import annotations

from typing import Any

from postgrest.exceptions import APIError

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client, local_vendors
from app.features.vendors.profile import get_vendor_profile

logger = get_logger(__name__)

# Contact fields unlock only after the client has paid (money collected on-platform).
_PAID_CONTACT_STATUSES = frozenset({"paid", "payout_released", "partially_refunded"})

_DEFAULT_PREFS = {
    "contact_phone": None,
    "share_email": True,
    "share_phone": True,
    "share_address": True,
}

# Cached after first PostgREST 42703 — avoids log spam when migration 028 is not applied yet.
_contact_prefs_columns_ok: bool | None = None


def _missing_contact_prefs_columns(err: Exception) -> bool:
    if not isinstance(err, APIError):
        return False
    code = getattr(err, "code", None)
    msg = str(err).lower()
    if code != "42703" and "does not exist" not in msg:
        return False
    return any(
        col in msg
        for col in ("contact_phone", "share_email", "share_phone", "share_address")
    )


def get_contact_settings(user_id: str) -> dict[str, Any]:
    global _contact_prefs_columns_ok
    if get_settings().local_auth_mode:
        return dict(_DEFAULT_PREFS)
    if _contact_prefs_columns_ok is False:
        return dict(_DEFAULT_PREFS)
    try:
        res = (
            get_client()
            .table("users")
            .select("contact_phone,share_email,share_phone,share_address")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        _contact_prefs_columns_ok = True
    except Exception as e:
        if _missing_contact_prefs_columns(e):
            _contact_prefs_columns_ok = False
            logger.warning(
                "get_contact_settings: run backend/sql/028_contact_sharing_preferences.sql — %s",
                e,
            )
            return dict(_DEFAULT_PREFS)
        logger.exception("get_contact_settings failed user_id=%s", user_id)
        return dict(_DEFAULT_PREFS)
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return dict(_DEFAULT_PREFS)
    row = rows[0]
    return {
        "contact_phone": row.get("contact_phone"),
        "share_email": bool(row.get("share_email", True)),
        "share_phone": bool(row.get("share_phone", True)),
        "share_address": bool(row.get("share_address", True)),
    }


def update_contact_settings(
    user_id: str,
    *,
    user_type: str = "client",
    contact_phone: str | None = None,
    share_email: bool | None = None,
    share_phone: bool | None = None,
    share_address: bool | None = None,
) -> dict[str, Any]:
    global _contact_prefs_columns_ok
    if get_settings().local_auth_mode:
        return dict(_DEFAULT_PREFS)
    if _contact_prefs_columns_ok is False:
        return dict(_DEFAULT_PREFS)
    patch: dict[str, Any] = {}
    is_vendor = user_type == "vendor"
    if contact_phone is not None and not is_vendor:
        t = contact_phone.strip()
        patch["contact_phone"] = t or None
    if share_email is not None:
        patch["share_email"] = share_email
    if share_phone is not None:
        patch["share_phone"] = share_phone
    if share_address is not None and not is_vendor:
        patch["share_address"] = share_address
    if not patch:
        return get_contact_settings(user_id)
    try:
        get_client().table("users").update(patch).eq("id", user_id).execute()
    except Exception as e:
        if _missing_contact_prefs_columns(e):
            _contact_prefs_columns_ok = False
            logger.warning(
                "update_contact_settings: run backend/sql/028_contact_sharing_preferences.sql — %s",
                e,
            )
            return dict(_DEFAULT_PREFS)
        raise
    return get_contact_settings(user_id)


def _vendor_payload_phone(vendor_user_id: str) -> str | None:
    row = get_vendor_profile(vendor_user_id)
    if not row:
        if get_settings().local_auth_mode:
            local = local_vendors.get(vendor_user_id)
            payload = local.get("payload") if isinstance(local, dict) else {}
        else:
            return None
    else:
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    if not isinstance(payload, dict):
        return None
    phone = payload.get("phone")
    return str(phone).strip() if isinstance(phone, str) and phone.strip() else None


def is_booking_contact_unlocked(payment_status: str | None) -> bool:
    return str(payment_status or "unpaid") in _PAID_CONTACT_STATUSES


def mask_booking_list_client_email(row: dict[str, Any]) -> dict[str, Any]:
    """Hide client email on vendor list rows until the booking is paid."""
    out = dict(row)
    if not is_booking_contact_unlocked(str(out.get("payment_status") or "unpaid")):
        out["client_email"] = None
    return out


def _mask_all_counterparty_contact(out: dict[str, Any], *, viewer_role: str) -> dict[str, Any]:
    # Event venue (event_address / event_postcode) is booking data, not contact
    # info — vendors need it to decide whether to accept or quote travel, so it
    # is never masked here. Only personal contact channels are gated.
    out.pop("counterparty_phone", None)
    out["client_email"] = None
    out["vendor_email"] = None
    return out


def apply_counterparty_contact_visibility(
    *,
    viewer_role: str,
    booking_status: str,
    payment_status: str,
    detail: dict[str, Any],
) -> dict[str, Any]:
    """
    Mask counterparty contact fields (email/phone) until the client has paid,
    then honour sharing prefs. Booking event venue is never masked — vendors
    need it to decide whether to accept. viewer_role: 'vendor' (viewing
    client) or 'client' (viewing vendor).
    """
    out = dict(detail)
    if not is_booking_contact_unlocked(payment_status):
        return _mask_all_counterparty_contact(out, viewer_role=viewer_role)

    if booking_status not in ("accepted", "completed"):
        return _mask_all_counterparty_contact(out, viewer_role=viewer_role)

    if viewer_role == "vendor":
        client_id = str(out.get("client_user_id") or "")
        prefs = get_contact_settings(client_id) if client_id else _DEFAULT_PREFS
        if not prefs.get("share_email"):
            out["client_email"] = None
        if prefs.get("share_phone") and prefs.get("contact_phone"):
            out["counterparty_phone"] = prefs["contact_phone"]
        else:
            out["counterparty_phone"] = None
        return out

    # Client viewing vendor — client always sees their own event location.
    vendor_id = str(out.get("vendor_user_id") or "")
    prefs = get_contact_settings(vendor_id) if vendor_id else _DEFAULT_PREFS
    if not prefs.get("share_email"):
        out["vendor_email"] = None
    phone = _vendor_payload_phone(vendor_id) if vendor_id else None
    if prefs.get("share_phone") and phone:
        out["counterparty_phone"] = phone
    else:
        out["counterparty_phone"] = None
    return out
