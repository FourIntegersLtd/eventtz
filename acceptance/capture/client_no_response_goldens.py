"""Capture the baseline's "vendor has not replied yet" email (the one that lists alternative vendors).

Run with `make capture SCRIPT=capture/client_no_response_goldens.py`. As in
`vendor_email_goldens.py`, the baseline's Resend call is swapped for a recorder
so nothing is sent, and the dedupe log is swapped for one that always allows the
send. Fixed `example.com` addresses and made-up vendor names keep it deterministic.

Output: `notifications/client_no_response.json`, one entry per case below.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import app.features.email.delivery_log as delivery_log  # type: ignore[import-not-found]
import app.features.email.service as email_service  # type: ignore[import-not-found]

BROWSE_URL = "https://www.eventtz.com/client/browse"
BOOKING_URL = "https://www.eventtz.com/client/bookings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

CASES: list[dict[str, Any]] = [
    {
        "label": "with_alternatives",
        "vendor_name": "Ama's Kitchen",
        "event_name": "Kofi's 30th",
        "alternatives": [
            {
                "name": "Spice Route Catering",
                "href": "https://www.eventtz.com/client/browse/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                "reply": "Usually replies within 2 hours",
            },
            {
                "name": "Golden Spoon",
                "href": "https://www.eventtz.com/client/browse/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                "reply": "Reply time varies",
            },
        ],
    },
    {
        "label": "without_alternatives",
        "vendor_name": "the vendor",
        "event_name": "your event",
        "alternatives": [],
    },
]


def capture_case(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline email for one case without sending it; returns the golden entry."""
    sent: dict[str, Any] = {}

    def record_send(**email: Any) -> bool:
        """Keep the call's keyword arguments (to, subject, html, text) and report success."""
        sent.update(email)
        return True

    email_service.resend_send = record_send
    delivery_log.claim_booking_email_send = lambda **_claim: True
    email_service.EmailService().send_client_vendor_no_response(
        to_email="client@example.com",
        recipient_user_id="00000000-0000-4000-8000-000000000000",
        booking_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        vendor_name=case["vendor_name"],
        event_name=case["event_name"],
        alternatives=case["alternatives"],
        browse_url=BROWSE_URL,
        booking_url=BOOKING_URL,
    )
    return {"input": case, "subject": sent["subject"], "html": sent["html"], "text": sent["text"]}


if __name__ == "__main__":
    golden_path = Path(sys.argv[1]) / "notifications" / "client_no_response.json"
    golden_path.parent.mkdir(parents=True, exist_ok=True)
    captured = {"client_no_response": [capture_case(case) for case in CASES]}
    golden_path.write_text(json.dumps(captured, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
