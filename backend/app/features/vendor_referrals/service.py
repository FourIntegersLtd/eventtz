"""Vendor-facing client referral info."""

from __future__ import annotations

from typing import Any

from app.core.constants import BOOKING_SERVICE_FEE_PERCENT
from app.core.db import get_db
from app.features.email.branding import public_email_url
from app.features.vendor_referrals.codes import normalize_client_referral_code
from app.features.vendor_referrals.tiers import referral_tiers_for_display


def vendor_client_referral_browse_url(vendor_user_id: str, code: str) -> str:
    vid = (vendor_user_id or "").strip()
    safe = (code or "").strip()
    return public_email_url(f"/client/browse/{vid}?vref={safe}")


def get_vendor_client_referral_info(vendor_user_id: str) -> dict[str, Any] | None:
    uid = str(vendor_user_id or "").strip()
    if not uid:
        return None
    res = (
        get_db()
        .table("vendors")
        .select("user_id,client_referral_code,client_referral_enabled,approval_status")
        .eq("user_id", uid)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    if str(row.get("approval_status") or "") != "approved":
        return None
    code = normalize_client_referral_code(row.get("client_referral_code")) or ""
    enabled = bool(row.get("client_referral_enabled", True))
    return {
        "referral_code": code,
        "has_referral_code": bool(code),
        "share_link": vendor_client_referral_browse_url(uid, code) if code else "",
        "service_fee_percent": float(BOOKING_SERVICE_FEE_PERCENT),
        "tiers": referral_tiers_for_display(),
        "enabled": enabled,
    }
