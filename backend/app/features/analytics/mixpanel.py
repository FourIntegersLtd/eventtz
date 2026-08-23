"""Server-side Mixpanel profile maintenance."""

from __future__ import annotations

import json

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def delete_mixpanel_profile(user_id: str) -> None:
    """Best-effort GDPR profile delete for a closed account."""
    token = str(getattr(get_settings(), "mixpanel_token", "") or "").strip()
    if not token:
        return
    host = str(getattr(get_settings(), "mixpanel_api_host", "") or "").strip() or (
        "https://api.mixpanel.com"
    )
    body = {
        "data": json.dumps(
            {"$token": token, "$distinct_id": user_id, "$delete": ""},
        ),
    }
    url = f"{host.rstrip('/')}/engage#profile-delete"
    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.post(url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
        if res.status_code >= 400:
            logger.warning(
                "Mixpanel profile delete HTTP %s user_id=%s: %s",
                res.status_code,
                user_id,
                res.text[:300],
            )
    except Exception:
        logger.warning("Mixpanel profile delete failed user_id=%s", user_id)
