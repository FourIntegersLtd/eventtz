"""Capture the admin alert emails the baseline renders (the contact-form alert today).

Run with `make capture SCRIPT=capture/notification_goldens.py`. The baseline's
Resend call is swapped for a recorder, so nothing is sent: the golden holds the
exact subject, recipients-free HTML and plain text the baseline would hand to
Resend. Output: `notifications/admin_contact_alert.json`, one entry per case.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import app.features.email.service as email_service  # type: ignore[import-not-found]

CONTACT_ALERT_CASES: list[dict[str, Any]] = [
    {
        "portal": "client",
        "user_email": "client@example.com",
        "subject_line": "Payments",
        "message": "My payout never arrived.",
        "booking_id": "11111111-1111-4111-8111-111111111111",
    },
    {
        "portal": "vendor",
        "user_email": None,
        "subject_line": "Other",
        "message": "Line one\nLine two with <b>tags</b> & ampersands",
        "booking_id": None,
    },
    {
        "portal": "admin",
        "user_email": "staff@example.com",
        "subject_line": "Bug report",
        "message": "Quotes \"double\" and 'single'",
        "booking_id": None,
    },
]


def capture_contact_alert(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline contact alert for one case without sending it."""
    sent: dict[str, Any] = {}

    def record_send(**email: Any) -> bool:
        """Stand-in for Resend: keep what would have been sent."""
        sent.update(email)
        return True

    email_service.resend_send = record_send
    email_service.EmailService().send_admin_contact_submitted(
        portal=case["portal"],
        user_email=case["user_email"],
        subject_line=case["subject_line"],
        message=case["message"],
        booking_id=case["booking_id"],
        to=["ops@example.com"],
    )
    return {"input": case, "subject": sent["subject"], "html": sent["html"], "text": sent["text"]}


if __name__ == "__main__":
    golden_path = Path(sys.argv[1]) / "notifications" / "admin_contact_alert.json"
    golden_path.parent.mkdir(parents=True, exist_ok=True)
    captured = [capture_contact_alert(case) for case in CONTACT_ALERT_CASES]
    golden_path.write_text(json.dumps(captured, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
