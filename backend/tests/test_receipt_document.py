"""Tests for server-generated receipt HTML documents."""

from __future__ import annotations

from app.features.bookings.receipt_document import (
    receipt_html_bytes,
    receipt_html_response,
)


def _sample_payload() -> dict:
    return {
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


def test_receipt_html_bytes_includes_event_and_total():
    html = receipt_html_bytes(_sample_payload()).decode("utf-8")
    assert "Summer party" in html
    assert "GBP 525" in html
    assert "EVT-A1B2C3D4" in html
    assert "<!DOCTYPE html>" in html


def test_receipt_html_response_attachment():
    resp = receipt_html_response(_sample_payload(), filename="receipt-EVT.html", inline=False)
    assert b"Summer party" in resp.body
    assert resp.media_type == "text/html; charset=utf-8"
    assert 'attachment; filename="receipt-EVT.html"' in resp.headers["Content-Disposition"]


def test_client_receipt_html_omits_payout_line():
    payload = _sample_payload()
    payload["payout_released_at"] = "2026-09-16T10:00:00+00:00"
    html = receipt_html_bytes(payload).decode("utf-8")
    assert "Payout:" not in html
