"""Tests for payment receipt builders."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings import messages as booking_messages
from app.features.bookings.receipts import (
    build_client_payment_receipt,
    build_vendor_payment_record,
    build_vendor_payout_statement,
    receipt_number,
)


def _paid_row(**overrides: object) -> dict:
    base = {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "event_name": "Summer party",
        "event_date": "2026-09-15",
        "line_items": [{"heading": "Gold package", "unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "payment_status": "paid",
        "paid_at": "2026-08-21T12:00:00+00:00",
        "payment_amount_gbp": 525.0,
        "vendor_amount_gbp": 500.0,
        "platform_fee_gbp": 25.0,
        "stripe_charge_id": "ch_testcharge12345678",
    }
    base.update(overrides)
    return base


def test_receipt_number_format():
    assert receipt_number("a1b2c3d4-e5f6-7890-abcd-ef1234567890") == "EVT-A1B2C3D4"


def test_client_receipt_uses_payment_snapshot_amounts():
    row = _paid_row()
    snap = {
        "payment_status": "paid",
        "paid_at": row["paid_at"],
        "payment_amount_gbp": 525.0,
        "vendor_amount_gbp": 500.0,
        "platform_fee_gbp": 25.0,
        "stripe_charge_id": "ch_testcharge12345678",
        "stripe_receipt_url": "https://stripe.com/receipt",
    }
    out = build_client_payment_receipt(
        row,
        vendor_display_name="Ada Events",
        snapshot=snap,
    )
    assert out["document_type"] == "client_payment_receipt"
    assert out["total_label"] == "GBP 525"
    assert out["payment_reference"] == "…12345678"
    assert out["stripe_receipt_url"] == "https://stripe.com/receipt"
    assert out["counterparty_name"] == "Ada Events"
    assert any(li["label"] == "Gold package" for li in out["line_items"])


def test_client_receipt_rejects_unpaid():
    row = _paid_row(payment_status="unpaid")
    with pytest.raises(ValueError, match=booking_messages.RECEIPT_NOT_AVAILABLE):
        build_client_payment_receipt(row, vendor_display_name="Vendor", snapshot=row)


def test_vendor_payment_record_shows_vendor_share():
    row = _paid_row()
    out = build_vendor_payment_record(row, client_display_name="Jane", snapshot=row)
    assert out["document_type"] == "vendor_payment_record"
    assert out["total_label"] == "GBP 500"
    assert out["platform_fee_label"] == "GBP 25"
    assert "held safely" in (out["status_note"] or "")


def test_vendor_payout_statement_requires_payout_released():
    row = _paid_row(payment_status="paid")
    with pytest.raises(ValueError, match=booking_messages.RECEIPT_NOT_AVAILABLE):
        build_vendor_payout_statement(row, client_display_name="Jane", snapshot=row)


def test_vendor_payout_statement_includes_transfer_ref():
    row = _paid_row(payment_status="payout_released")
    snap = {
        **row,
        "payout_released_at": "2026-09-16T10:00:00+00:00",
        "stripe_transfer_id": "tr_transfer12345678",
    }
    out = build_vendor_payout_statement(row, client_display_name="Jane", snapshot=snap)
    assert out["document_type"] == "vendor_payout_statement"
    assert out["transfer_reference"] == "…12345678"
    assert out["payout_released_at"] == snap["payout_released_at"]


def test_refunded_receipt_has_status_note():
    row = _paid_row(payment_status="refunded")
    out = build_client_payment_receipt(row, vendor_display_name="Vendor", snapshot=row)
    assert out["status_note"] == "This payment was refunded in full."


def test_frozen_snapshot_preserves_line_items_when_booking_changes():
    frozen_payload = {
        "document_type": "client_payment_receipt",
        "receipt_number": "EVT-A1B2C3D4",
        "booking_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "event_name": "Summer party",
        "event_date": "2026-09-15",
        "payment_status": "paid",
        "paid_at": "2026-08-21T12:00:00+00:00",
        "counterparty_name": "Ada Events",
        "line_items": [{"label": "Gold package", "amount_label": "GBP 500"}],
        "total_label": "GBP 525",
        "payment_reference": "…12345678",
        "stripe_receipt_url": None,
        "status_note": None,
    }
    row = _paid_row(
        line_items=[{"heading": "Changed package", "unit_price_gbp": 999.0}],
        payment_receipt_snapshot=frozen_payload,
    )
    snap = {
        "payment_status": "paid",
        "paid_at": row["paid_at"],
        "payment_amount_gbp": 525.0,
        "payment_receipt_snapshot": frozen_payload,
    }
    out = build_client_payment_receipt(row, vendor_display_name="Ada Events", snapshot=snap)
    assert out["total_label"] == "GBP 525"
    assert out["line_items"] == frozen_payload["line_items"]
    assert out["line_items"][0]["label"] == "Gold package"


def test_vendor_payment_record_after_payout_shows_released_note():
    row = _paid_row(payment_status="payout_released")
    out = build_vendor_payment_record(row, client_display_name="Jane", snapshot=row)
    assert "released" in (out["status_note"] or "").lower()
    assert "held safely" not in (out["status_note"] or "").lower()


def test_frozen_client_receipt_hides_payout_date_after_vendor_payout():
    frozen_payload = {
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
        "total_label": "GBP 525",
        "payment_reference": "…12345678",
        "stripe_receipt_url": None,
        "status_note": None,
    }
    row = _paid_row(payment_receipt_snapshot=frozen_payload)
    snap = {
        "payment_status": "payout_released",
        "paid_at": row["paid_at"],
        "payout_released_at": "2026-09-16T10:00:00+00:00",
        "payment_receipt_snapshot": frozen_payload,
    }
    out = build_client_payment_receipt(row, vendor_display_name="Ada Events", snapshot=snap)
    assert out["payout_released_at"] is None


def test_payment_receipt_response_rejects_corrupt_payload():
    from app.features.bookings.receipt_document import payment_receipt_response

    with pytest.raises(ValueError, match=booking_messages.RECEIPT_NOT_AVAILABLE):
        payment_receipt_response(
            {
                "document_type": "client_payment_receipt",
                "receipt_number": "EVT-A1B2C3D4",
                "booking_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "event_name": "Summer party",
                "event_date": "2026-09-15",
                "payment_status": "paid",
                "counterparty_name": "Ada Events",
            },
        )


def test_payment_receipt_payload_serializes_booking_request_id():
    from app.contracts.receipts import PaymentReceiptPayload

    payload = PaymentReceiptPayload(
        document_type="client_payment_receipt",
        receipt_number="EVT-A1B2C3D4",
        booking_request_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        event_name="Summer party",
        event_date="2026-09-15",
        payment_status="paid",
        counterparty_name="Ada Events",
        total_label="GBP 525",
    )
    dumped = payload.model_dump(mode="json", by_alias=True)
    assert dumped["booking_request_id"] == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    assert "booking_id" not in dumped


@patch("app.features.vendor_referrals.booking_discount.get_vendor_referral_row_by_code")
def test_client_receipt_live_lines_include_referral_discount(mock_lookup: MagicMock) -> None:
    mock_lookup.return_value = {
        "user_id": "vendor-1",
        "client_referral_enabled": True,
        "approval_status": "approved",
        "client_referral_code": "254106",
    }
    row = _paid_row(
        vendor_user_id="vendor-1",
        vendor_referral_code="254106",
        payment_amount_gbp=515.0,
        platform_fee_gbp=15.0,
    )
    out = build_client_payment_receipt(row, vendor_display_name="Ada Events", snapshot=row)
    assert out["total_label"] == "GBP 515"
    assert any(li["label"] == "Referral discount" for li in out["line_items"])
    assert any(
        li["amount_label"] == "GBP -10"
        for li in out["line_items"]
        if li["label"] == "Referral discount"
    )
