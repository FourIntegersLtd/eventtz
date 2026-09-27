"""Receipt emails render exactly as the baseline's did (fixed payloads in `receipts/receipt_emails.json`)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.notifications.service import render_receipt_email

BOOKING_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
CASES: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent / "receipts" / "receipt_emails.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["id"])
def test_receipt_email_matches_golden(case: dict[str, Any]) -> None:
    email = render_receipt_email(case["payload"], to_email="client@example.com", booking_id=BOOKING_ID)
    assert email is not None
    assert list(email.to) == case["to"]
    assert email.subject == case["subject"]
    assert email.html == case["html"]
    assert email.text == case["text"]
