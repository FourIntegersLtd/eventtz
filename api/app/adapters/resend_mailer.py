"""`Mailer` backed by the Resend HTTP API."""

from __future__ import annotations

import httpx

from app.core.logging import get_logger
from app.core.ports import OutgoingEmail
from app.core.settings import get_settings

log = get_logger(__name__)

RESEND_URL = "https://api.resend.com/emails"
# Every email is sent from the support inbox so replies reach a person.
SENDER = "Eventtz <hello@eventtz.com>"


class ResendMailer:
    """Posts each email to Resend; logs and returns False instead of raising."""

    def send(self, email: OutgoingEmail) -> bool:
        """Deliver `email`; False when the key is missing, there are no recipients, or Resend refuses."""
        api_key = get_settings().resend_api_key.strip()
        if not api_key:
            log.warning("email skipped (RESEND_API_KEY not set): %s", email.subject)
            return False
        recipients = [address.strip() for address in email.to if address and address.strip()]
        if not recipients:
            log.warning("email skipped (no recipients): %s", email.subject)
            return False
        payload: dict[str, object] = {
            "from": SENDER,
            "to": recipients,
            "subject": email.subject,
            "html": email.html,
        }
        if email.text:
            payload["text"] = email.text
        try:
            with httpx.Client(timeout=15.0) as http:
                response = http.post(RESEND_URL, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
        except Exception:
            log.exception("Resend send failed subject=%s", email.subject)
            return False
        if response.status_code >= 400:
            log.warning("Resend API error %s: %s", response.status_code, response.text[:500])
            return False
        return True
