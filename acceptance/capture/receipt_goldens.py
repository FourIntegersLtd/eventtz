"""Capture receipt HTML documents from the baseline renderer.

Run with `make capture SCRIPT=capture/receipt_goldens.py`. Output:
`receipts/receipt_documents.json` — two cases per document type, byte-exact HTML.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from app.features.bookings.receipt_document import receipt_html_bytes  # type: ignore[import-not-found]

BASE_PAYLOAD: dict[str, Any] = {
    "document_type": "client_payment_receipt",
    "receipt_number": "EVT-A1B2C3D4",
    "booking_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "event_name": "Summer party",
    "event_date": "2026-09-15",
    "payment_status": "paid",
    "paid_at": "2026-08-21T12:00:00+00:00",
    "payout_released_at": None,
    "counterparty_name": "Ada Events",
    "line_items": [{"label": "Gold package", "amount_label": "GBP 500"}],
    "subtotal_label": "GBP 500",
    "service_fee_label": "GBP 25",
    "service_fee_percent": 5.0,
    "total_label": "GBP 525",
    "vendor_share_label": None,
    "platform_fee_label": None,
    "payment_reference": "…12345678",
    "transfer_reference": None,
    "stripe_receipt_url": None,
    "status_note": None,
}

CASES: list[dict[str, Any]] = [
    {"id": "client_paid", "payload": dict(BASE_PAYLOAD)},
    {
        "id": "client_refunded",
        "payload": {
            **BASE_PAYLOAD,
            "payment_status": "refunded",
            "status_note": "This payment was refunded in full.",
        },
    },
    {
        "id": "vendor_payment_record",
        "payload": {
            **BASE_PAYLOAD,
            "document_type": "vendor_payment_record",
            "counterparty_name": "Jane Client",
            "service_fee_label": None,
            "service_fee_percent": None,
            "total_label": "GBP 500",
            "vendor_share_label": "GBP 500",
            "platform_fee_label": "GBP 25",
            "status_note": (
                "Client payment received. Your share is held safely with Eventtz until the event "
                "is complete and both sides confirm — or the automatic release date passes."
            ),
        },
    },
    {
        "id": "vendor_payment_record_released",
        "payload": {
            **BASE_PAYLOAD,
            "document_type": "vendor_payment_record",
            "payment_status": "payout_released",
            "counterparty_name": "Jane Client",
            "service_fee_label": None,
            "service_fee_percent": None,
            "total_label": "GBP 500",
            "vendor_share_label": "GBP 500",
            "platform_fee_label": "GBP 25",
            "status_note": (
                "Client payment received. Your share has been released to your connected Stripe account."
            ),
        },
    },
    {
        "id": "vendor_payout_statement",
        "payload": {
            **BASE_PAYLOAD,
            "document_type": "vendor_payout_statement",
            "payment_status": "payout_released",
            "payout_released_at": "2026-09-16T10:00:00+00:00",
            "counterparty_name": "Jane Client",
            "line_items": [{"label": "Vendor share", "amount_label": "GBP 500"}],
            "subtotal_label": None,
            "service_fee_label": None,
            "service_fee_percent": None,
            "total_label": "GBP 500",
            "vendor_share_label": "GBP 500",
            "platform_fee_label": None,
            "transfer_reference": "…87654321",
            "status_note": (
                "Payout sent to your connected Stripe account. Bank arrival times depend on your bank."
            ),
        },
    },
    {
        "id": "vendor_payout_statement_alt",
        "payload": {
            **BASE_PAYLOAD,
            "document_type": "vendor_payout_statement",
            "receipt_number": "EVT-DEADBEEF",
            "booking_request_id": "deadbeef-dead-beef-dead-beefdeadbeef",
            "event_name": "Winter gala",
            "event_date": "2026-12-01",
            "payment_status": "payout_released",
            "paid_at": "2026-11-20T09:00:00+00:00",
            "payout_released_at": "2026-12-02T11:30:00+00:00",
            "counterparty_name": "Sam Planner",
            "line_items": [{"label": "Vendor share", "amount_label": "GBP 1,200"}],
            "subtotal_label": None,
            "service_fee_label": None,
            "service_fee_percent": None,
            "total_label": "GBP 1,200",
            "vendor_share_label": "GBP 1,200",
            "platform_fee_label": None,
            "payment_reference": "…ABCDEF12",
            "transfer_reference": "…TRANSFER",
            "status_note": (
                "Payout sent to your connected Stripe account. Bank arrival times depend on your bank."
            ),
        },
    },
]


def capture_case(case: dict[str, Any]) -> dict[str, Any]:
    """Render one payload through the baseline's receipt HTML builder."""
    html = receipt_html_bytes(case["payload"]).decode("utf-8")
    return {"id": case["id"], "payload": case["payload"], "html": html}


if __name__ == "__main__":
    golden_path = Path(sys.argv[1]) / "receipts" / "receipt_documents.json"
    golden_path.parent.mkdir(parents=True, exist_ok=True)
    captured = [capture_case(case) for case in CASES]
    golden_path.write_text(json.dumps(captured, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
