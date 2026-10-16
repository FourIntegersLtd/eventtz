"""The client's "vendor has not replied yet" email reads exactly as the baseline's did.

Captured by `acceptance/capture/client_no_response_goldens.py`: one case with two
alternative vendors and one without any.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.notifications.domain_booking_emails import (
    AlternativeVendorLine,
    client_vendor_no_response_email,
)
from app.features.notifications.service import render_booking_notification

GOLDENS: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent / "notifications" / "client_no_response.json").read_text(encoding="utf-8")
)["client_no_response"]
BOOKING_URL = "https://www.eventtz.com/client/bookings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
BROWSE_URL = "https://www.eventtz.com/client/browse"


@pytest.mark.parametrize("case", GOLDENS, ids=lambda case: case["input"]["label"])
def test_client_no_response_email_matches_baseline(case: dict[str, Any]) -> None:
    """Subject, HTML and text are byte-identical to what the baseline handed to Resend."""
    given = case["input"]
    content = client_vendor_no_response_email(
        vendor_name=given["vendor_name"],
        event_name=given["event_name"],
        alternatives=[AlternativeVendorLine(**alternative) for alternative in given["alternatives"]],
        booking_url=BOOKING_URL,
        browse_url=BROWSE_URL,
    )

    email = render_booking_notification("client@example.com", content)

    assert email.to == ("client@example.com",)
    assert email.subject == case["subject"]
    assert email.html == case["html"]
    assert email.text == case["text"]
