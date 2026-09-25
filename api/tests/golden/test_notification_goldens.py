"""Staff alert emails render exactly as the baseline's did (captured by `notification_goldens.py`)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.notifications.service import send_contact_submitted_alert
from tests.support.fakes import FakeMailer

CONTACT_ALERTS = json.loads(
    (Path(__file__).parent / "notifications" / "admin_contact_alert.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", CONTACT_ALERTS, ids=lambda case: case["input"]["portal"])
def test_contact_alert_matches_baseline(case: dict[str, Any]) -> None:
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_contact_submitted_alert(
        mailer,
        portal=submitted["portal"],
        user_email=submitted["user_email"],
        subject_label=submitted["subject_line"],
        message=submitted["message"],
        booking_id=submitted["booking_id"],
    )
    (email,) = mailer.sent
    assert email.subject == case["subject"]
    assert email.html == case["html"]
    assert email.text == case["text"]
