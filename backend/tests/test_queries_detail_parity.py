"""Parity tests for booking query refactors (DRY helpers must match prior output)."""

from __future__ import annotations

from app.features.bookings.queries import (
    _booking_detail_shared_fields,
    _list_pricing_breakdown,
)
from app.features.vendor_referrals.booking_discount import build_pricing_breakdown_for_booking_row


def _sample_booking_row() -> dict:
    return {
        "id": "br-parity-1",
        "status": "pending",
        "event_name": "Summer party",
        "event_date": "2026-09-15",
        "event_end_date": "2026-09-16",
        "event_postcode": "SW1A 1AA",
        "event_address": "10 Downing Street",
        "notes": "Outdoor setup",
        "total_label": "GBP 500",
        "selected_option_ids": ["opt-1"],
        "line_items": [{"id": "opt-1", "quantity": 1, "unit_price_gbp": 500.0}],
        "vendor_adjustments": [],
        "created_at": "2026-08-01T12:00:00Z",
        "paid_at": None,
        "payment_status": "unpaid",
        "client_completion_confirmed_at": None,
        "vendor_completion_confirmed_at": None,
        "initiator": "client",
        "conversation_id": "conv-1",
        "service_fee_percent": 5.0,
        "vendor_referral_code": "VREF10",
        "vendor_user_id": "vendor-1",
    }


def test_list_pricing_breakdown_matches_direct_builder():
    row = _sample_booking_row()
    assert _list_pricing_breakdown(row) == build_pricing_breakdown_for_booking_row(row)


def test_booking_detail_shared_fields_cover_core_detail_shape():
    row = _sample_booking_row()
    shared = _booking_detail_shared_fields(row)

    assert shared["id"] == "br-parity-1"
    assert shared["status"] == "pending"
    assert shared["event_name"] == "Summer party"
    assert shared["event_date"] == "2026-09-15"
    assert shared["event_end_date"] == "2026-09-16"
    assert shared["event_postcode"] == "SW1A 1AA"
    assert shared["event_address"] == "10 Downing Street"
    assert shared["notes"] == "Outdoor setup"
    assert shared["total_label"] == "GBP 500"
    assert shared["selected_option_ids"] == ["opt-1"]
    assert shared["line_items"] == row["line_items"]
    assert shared["vendor_adjustments"] == []
    assert shared["payment_status"] == "unpaid"
    assert shared["initiator"] == "client"
    assert shared["conversation_id"] == "conv-1"
    assert shared["service_fee_percent"] == 5.0
    assert shared["vendor_referral_code"] == "VREF10"
    assert shared["payout_auto_release_at"] is None
