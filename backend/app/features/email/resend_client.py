"""Small Resend API client (httpx). Skips sending when email is disabled or the API key is missing."""

from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.features.email.constants import EMAIL_ENABLED, EMAIL_FROM
from app.core.logging import get_logger

logger = get_logger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


def send_email(
    *,
    to: list[str],
    subject: str,
    html: str,
    text: str | None = None,
) -> bool:
    settings = get_settings()
    if settings.local_auth_mode or not EMAIL_ENABLED:
        logger.info("email skipped (local auth or disabled): %s", subject)
        return False
    api_key = settings.resend_api_key.strip()
    if not api_key:
        logger.warning("email skipped (RESEND_API_KEY not set): %s", subject)
        return False
    recipients = [e.strip() for e in to if e and e.strip()]
    if not recipients:
        logger.warning("email skipped (no recipients): %s", subject)
        return False

    payload: dict[str, object] = {
        "from": EMAIL_FROM,
        "to": recipients,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                _RESEND_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if res.status_code >= 400:
            logger.warning("Resend API error %s: %s", res.status_code, res.text[:500])
            return False
        return True
    except Exception:
        logger.exception("Resend send failed subject=%s", subject)
        return False
