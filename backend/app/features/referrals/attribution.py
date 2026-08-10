"""Attach referral attribution when a vendor signs up."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.referrals.partners import get_active_partner_by_slug
from app.features.referrals.slug import normalize_slug

logger = get_logger(__name__)


def try_attribute_vendor_signup(*, user_id: str, referral_code: str | None) -> bool:
    """Record first-touch referral for a new vendor. Never raises."""
    code = normalize_slug(referral_code or "")
    if not code:
        return False
    partner = get_active_partner_by_slug(code)
    if not partner:
        return False
    partner_id = str(partner.get("id") or "")
    if not partner_id:
        return False
    row: dict[str, Any] = {
        "user_id": user_id,
        "referral_partner_id": partner_id,
        "referral_slug": code,
        "shoutout_completed": False,
    }
    try:
        get_client().table("referral_attributions").insert(row).execute()
        logger.info(
            "referral_attribution user_id=%s partner_id=%s slug=%s",
            user_id,
            partner_id,
            code,
        )
        return True
    except Exception as e:
        # Idempotent: user already attributed (PK on user_id).
        logger.info(
            "referral_attribution skipped user_id=%s slug=%s: %s",
            user_id,
            code,
            e,
        )
        return False


def update_shoutout_completed(*, user_id: str, shoutout_completed: bool) -> dict[str, Any] | None:
    patch: dict[str, Any] = {
        "shoutout_completed": shoutout_completed,
        "shoutout_completed_at": datetime.now(timezone.utc).isoformat() if shoutout_completed else None,
    }
    res = get_client().table("referral_attributions").update(patch).eq("user_id", user_id).execute()
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    return data[0]
