"""Capture the account emails the baseline renders: verification, password reset/changed, welcome.

Run with `make capture SCRIPT=capture/account_email_goldens.py`. Like
`notification_goldens.py`, the baseline's Resend call is swapped for a recorder
so nothing is ever sent: each golden holds the exact recipient, subject, HTML
and text the baseline would have handed to Resend. Fixed `example.com`
addresses and fixed tokens/URLs keep the output deterministic.

Output: `notifications/account_emails.json`, one entry per case below.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

import app.features.email.dispatch as email_dispatch  # type: ignore[import-not-found]
import app.features.email.service as email_service  # type: ignore[import-not-found]

VERIFY_URL = "https://www.eventtz.com/verify-email?token=verify-token-fixed"
RESET_URL = "https://www.eventtz.com/reset-password?token=reset-token-fixed"

VERIFICATION_CASES: list[dict[str, Any]] = [
    {"label": "client", "email": "client@example.com", "verify_url": VERIFY_URL, "user_type": "client"},
    {"label": "vendor", "email": "vendor@example.com", "verify_url": VERIFY_URL, "user_type": "vendor"},
]

RESET_CASES: list[dict[str, Any]] = [
    {
        "label": "client",
        "email": "client@example.com",
        "reset_url": RESET_URL,
        "user_type": "client",
        "purpose": "reset",
    },
    {
        "label": "vendor",
        "email": "vendor@example.com",
        "reset_url": RESET_URL,
        "user_type": "vendor",
        "purpose": "reset",
    },
    {
        "label": "admin_reset",
        "email": "admin@example.com",
        "reset_url": RESET_URL,
        "user_type": "admin",
        "purpose": "reset",
    },
    {
        "label": "admin_setup",
        "email": "admin@example.com",
        "reset_url": RESET_URL,
        "user_type": "admin",
        "purpose": "setup",
    },
]

PASSWORD_CHANGED_CASES: list[dict[str, Any]] = [
    {"label": "client", "email": "client@example.com", "user_type": "client"},
    {"label": "admin", "email": "admin@example.com", "user_type": "admin"},
]

WELCOME_CASES: list[dict[str, Any]] = [
    {"label": "client", "email": "jane.doe@example.com", "user_type": "client"},
    {"label": "vendor", "email": "jane.doe@example.com", "user_type": "vendor"},
    {"label": "admin", "email": "jane.doe@example.com", "user_type": "admin"},
]


def _record_send() -> tuple[dict[str, Any], Callable[..., bool]]:
    """A stand-in for Resend that keeps what would have been sent instead of sending it."""
    sent: dict[str, Any] = {}

    def record_send(**email: Any) -> bool:
        """Keep the call's keyword arguments (to, subject, html, text) and report success."""
        sent.update(email)
        return True

    return sent, record_send


def _golden_entry(case: dict[str, Any], sent: dict[str, Any]) -> dict[str, Any]:
    """One golden entry: the case that produced it, plus the recipient/subject/html/text sent."""
    return {
        "input": case,
        "to": sent["to"],
        "subject": sent["subject"],
        "html": sent["html"],
        "text": sent["text"],
    }


def capture_verification(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline "verify your email" send for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_email_verification_email(
        email=case["email"],
        verify_url=case["verify_url"],
        user_type=case["user_type"],
    )
    return _golden_entry(case, sent)


def capture_reset(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline password reset / admin setup send for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_password_reset_email(
        email=case["email"],
        reset_url=case["reset_url"],
        user_type=case["user_type"],
        purpose=case["purpose"],
    )
    return _golden_entry(case, sent)


def capture_password_changed(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline "password changed" notice for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_password_changed_email(email=case["email"], user_type=case["user_type"])
    return _golden_entry(case, sent)


def capture_welcome(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline client/vendor/admin welcome email for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_welcome_email(email=case["email"], user_type=case["user_type"])
    return _golden_entry(case, sent)


if __name__ == "__main__":
    golden_path = Path(sys.argv[1]) / "notifications" / "account_emails.json"
    golden_path.parent.mkdir(parents=True, exist_ok=True)
    captured = {
        "verification": [capture_verification(case) for case in VERIFICATION_CASES],
        "reset": [capture_reset(case) for case in RESET_CASES],
        "password_changed": [capture_password_changed(case) for case in PASSWORD_CHANGED_CASES],
        "welcome": [capture_welcome(case) for case in WELCOME_CASES],
    }
    golden_path.write_text(json.dumps(captured, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
