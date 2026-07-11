"""Contact-sharing preferences stored on public.users."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client, local_vendors
from app.features.vendors.profile import get_vendor_profile

logger = get_logger(__name__)

_DEFAULT_PREFS = {
    "contact_phone": None,
    "share_email": True,
    "share_phone": True,
    "share_address": True,
}


def get_contact_settings(user_id: str) -> dict[str, Any]:
    if get_settings().local_auth_mode:
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
    except Exception:
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
    contact_phone: str | None = None,
    share_email: bool | None = None,
    share_phone: bool | None = None,
    share_address: bool | None = None,
) -> dict[str, Any]:
    if get_settings().local_auth_mode:
        return dict(_DEFAULT_PREFS)
    patch: dict[str, Any] = {}
    if contact_phone is not None:
        t = contact_phone.strip()
        patch["contact_phone"] = t or None
    if share_email is not None:
        patch["share_email"] = share_email
    if share_phone is not None:
        patch["share_phone"] = share_phone
    if share_address is not None:
        patch["share_address"] = share_address
    if not patch:
        return get_contact_settings(user_id)
    get_client().table("users").update(patch).eq("id", user_id).execute()
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


def apply_counterparty_contact_visibility(
    *,
    viewer_role: str,
    booking_status: str,
    detail: dict[str, Any],
) -> dict[str, Any]:
    """
    Mask counterparty contact fields based on sharing prefs once a booking is accepted.
    viewer_role: 'vendor' (viewing client) or 'client' (viewing vendor).
    """
    out = dict(detail)
    if booking_status != "accepted" and booking_status != "completed":
        # Before acceptance, only show minimal identifiers already in the API.
        out.pop("counterparty_phone", None)
        if viewer_role == "vendor":
            out["event_address"] = None
        return out

    if viewer_role == "vendor":
        client_id = str(out.get("client_user_id") or "")
        prefs = get_contact_settings(client_id) if client_id else _DEFAULT_PREFS
        if not prefs.get("share_email"):
            out["client_email"] = None
        if prefs.get("share_phone") and prefs.get("contact_phone"):
            out["counterparty_phone"] = prefs["contact_phone"]
        else:
            out["counterparty_phone"] = None
        if not prefs.get("share_address"):
            out["event_address"] = None
            out["event_postcode"] = out.get("event_postcode") if out.get("event_postcode") else None
        return out

    # Client viewing vendor — client always sees their own event location.
    vendor_id = str(out.get("vendor_user_id") or "")
    prefs = get_contact_settings(vendor_id) if vendor_id else _DEFAULT_PREFS
    if not prefs.get("share_email"):
        out["vendor_email"] = None
    phone = _vendor_payload_phone(vendor_id) if vendor_id else None
    if prefs.get("share_phone") and phone:
        out["counterparty_phone"] = phone
    elif prefs.get("share_phone") and prefs.get("contact_phone"):
        out["counterparty_phone"] = prefs["contact_phone"]
    else:
        out["counterparty_phone"] = None
    return out
