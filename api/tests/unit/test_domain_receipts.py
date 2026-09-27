"""Pure receipt builders match the baseline's `test_receipts.py` cases."""

from __future__ import annotations

from typing import Any

import pytest

from app.features.bookings import domain_receipts, service_pricing
from app.features.bookings.errors import ReceiptNotAvailable
from app.features.bookings.rows import ReceiptBookingRow
from app.features.bookings.schemas_receipts import PaymentReceiptPayload
from app.features.bookings.service_receipts import payment_receipt_response
from app.features.pricing import domain as pricing_domain


def _paid_row(**overrides: object) -> ReceiptBookingRow:
    """A paid booking row with sensible defaults for receipt builder tests."""
    base: dict[str, Any] = {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "client_user_id": "11111111-1111-4111-8111-111111111111",
        "vendor_user_id": "22222222-2222-4222-8222-222222222222",
        "status": "accepted",
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
    return ReceiptBookingRow.model_validate(base)


def _pricing(booking: ReceiptBookingRow) -> dict[str, Any]:
    """Pricing breakdown dict for a test booking with no referral owner."""
    return service_pricing.breakdown_for(booking, owners={}).to_dict()


def test_receipt_number_format() -> None:
    assert domain_receipts.receipt_number("a1b2c3d4-e5f6-7890-abcd-ef1234567890") == "EVT-A1B2C3D4"


def test_client_receipt_uses_payment_snapshot_amounts() -> None:
    booking = _paid_row()
    out = domain_receipts.build_client_payment_receipt(
        booking, pricing_breakdown=_pricing(booking), vendor_display_name="Ada Events"
    )
    assert out["document_type"] == "client_payment_receipt"
    assert out["total_label"] == "GBP 525"
    assert out["payment_reference"] == "…12345678"
    assert out["counterparty_name"] == "Ada Events"
    assert any(line["label"] == "Gold package" for line in out["line_items"])


def test_client_receipt_rejects_unpaid() -> None:
    booking = _paid_row(payment_status="unpaid")
    with pytest.raises(ReceiptNotAvailable):
        domain_receipts.build_client_payment_receipt(
            booking, pricing_breakdown=_pricing(booking), vendor_display_name="Vendor"
        )


def test_vendor_payment_record_shows_vendor_share() -> None:
    booking = _paid_row()
    out = domain_receipts.build_vendor_payment_record(
        booking, pricing_breakdown=_pricing(booking), client_display_name="Jane"
    )
    assert out["document_type"] == "vendor_payment_record"
    assert out["total_label"] == "GBP 500"
    assert out["platform_fee_label"] == "GBP 25"
    assert "held safely" in (out["status_note"] or "")


def test_vendor_payout_statement_requires_payout_released() -> None:
    booking = _paid_row(payment_status="paid")
    with pytest.raises(ReceiptNotAvailable):
        domain_receipts.build_vendor_payout_statement(
            booking, pricing_breakdown=_pricing(booking), client_display_name="Jane"
        )


def test_vendor_payout_statement_includes_transfer_ref() -> None:
    booking = _paid_row(
        payment_status="payout_released",
        payout_released_at="2026-09-16T10:00:00+00:00",
        stripe_transfer_id="tr_transfer12345678",
    )
    out = domain_receipts.build_vendor_payout_statement(
        booking, pricing_breakdown=_pricing(booking), client_display_name="Jane"
    )
    assert out["document_type"] == "vendor_payout_statement"
    assert out["transfer_reference"] == "…12345678"
    assert out["payout_released_at"] == "2026-09-16T10:00:00+00:00"


def test_refunded_receipt_has_status_note() -> None:
    booking = _paid_row(payment_status="refunded")
    out = domain_receipts.build_client_payment_receipt(
        booking, pricing_breakdown=_pricing(booking), vendor_display_name="Vendor"
    )
    assert out["status_note"] == "This payment was refunded in full."


def test_frozen_snapshot_preserves_line_items_when_booking_changes() -> None:
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
    booking = _paid_row(
        line_items=[{"heading": "Changed package", "unit_price_gbp": 999.0}],
        payment_receipt_snapshot=frozen_payload,
    )
    out = domain_receipts.payload_from_frozen_or_build(
        booking=booking,
        document_type="client_payment_receipt",
        build_live=lambda: domain_receipts.build_client_payment_receipt(
            booking, pricing_breakdown=_pricing(booking), vendor_display_name="Ada Events"
        ),
    )
    assert out["total_label"] == "GBP 525"
    assert out["line_items"] == frozen_payload["line_items"]


def test_vendor_payment_record_after_payout_shows_released_note() -> None:
    booking = _paid_row(payment_status="payout_released")
    out = domain_receipts.build_vendor_payment_record(
        booking, pricing_breakdown=_pricing(booking), client_display_name="Jane"
    )
    assert "released" in (out["status_note"] or "").lower()
    assert "held safely" not in (out["status_note"] or "").lower()


def test_frozen_client_receipt_hides_payout_date_after_vendor_payout() -> None:
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
    booking = _paid_row(
        payment_receipt_snapshot=frozen_payload,
        payment_status="payout_released",
        payout_released_at="2026-09-16T10:00:00+00:00",
    )
    out = domain_receipts.payload_from_frozen_or_build(
        booking=booking,
        document_type="client_payment_receipt",
        build_live=lambda: domain_receipts.build_client_payment_receipt(
            booking, pricing_breakdown=_pricing(booking), vendor_display_name="Ada Events"
        ),
    )
    assert out["payout_released_at"] is None


def test_payment_receipt_response_rejects_corrupt_payload() -> None:
    with pytest.raises(ReceiptNotAvailable):
        payment_receipt_response(
            {
                "document_type": "client_payment_receipt",
                "receipt_number": "EVT-A1B2C3D4",
                "booking_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "event_name": "Summer party",
                "event_date": "2026-09-15",
                "payment_status": "paid",
                "counterparty_name": "Ada Events",
            }
        )


def test_payment_receipt_payload_serializes_booking_request_id() -> None:
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


def test_client_receipt_live_lines_include_referral_discount() -> None:
    booking = _paid_row(
        vendor_referral_code="254106",
        payment_amount_gbp=515.0,
        platform_fee_gbp=15.0,
    )

    pricing_breakdown = pricing_domain.build_pricing_breakdown(
        line_items=booking.line_items,
        vendor_adjustments=[],
        service_fee_percent=5.0,
        referral_fee_discount_gbp=10.0,
        referral_tier_min_spend_gbp=100.0,
    ).to_dict()
    out = domain_receipts.build_client_payment_receipt(
        booking, pricing_breakdown=pricing_breakdown, vendor_display_name="Ada Events"
    )
    assert out["total_label"] == "GBP 515"
    assert any(line["label"] == "Referral discount" for line in out["line_items"])
    assert any(
        line["amount_label"] == "GBP -10"
        for line in out["line_items"]
        if line["label"] == "Referral discount"
    )
