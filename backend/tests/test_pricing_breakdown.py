"""Tests for booking pricing breakdown and initial-total UX."""

from __future__ import annotations

from app.features.bookings.pricing import build_pricing_breakdown
from app.features.bookings.queries import _initial_client_total_label


def test_client_total_with_line_discount_only():
    pb = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": 100.0}, {"unit_price_gbp": -10.0}],
        vendor_adjustments=[],
        service_fee_percent=5.0,
    )
    assert pb["line_items_subtotal_gbp"] == 90.0
    assert pb["service_fee_gbp"] == 4.5
    assert pb["client_total_gbp"] == 94.5
    assert pb["client_total_label"] == "GBP 94.50"


def test_surcharge_does_not_increase_service_fee():
    """£90 quote + £20 setup: fee stays on quoted £90, client pays £114.50."""
    pb = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": 90.0}],
        vendor_adjustments=[{"tag": "other", "label": "setup fee", "amount_gbp": 20.0}],
        service_fee_percent=5.0,
    )
    assert pb["vendor_portion_gbp"] == 110.0
    assert pb["service_fee_gbp"] == 4.5
    assert pb["client_total_gbp"] == 114.5
    assert pb["client_total_label"] == "GBP 114.50"


def test_vendor_discount_adjustment_reduces_fee_base():
    pb = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": 100.0}],
        vendor_adjustments=[{"tag": "discount", "label": "Discount", "amount_gbp": -10.0}],
        service_fee_percent=5.0,
    )
    assert pb["vendor_portion_gbp"] == 90.0
    assert pb["service_fee_gbp"] == 4.5
    assert pb["client_total_gbp"] == 94.5


def test_initial_label_repaired_when_backfill_matches_updated_total():
    row = {
        "initial_client_total_label": "GBP 115.5",
        "total_label": "GBP 115.5",
        "line_items": [{"unit_price_gbp": 90.0}],
        "vendor_adjustments": [{"id": "a1", "tag": "other", "label": "setup", "amount_gbp": 20.0}],
    }
    pb = build_pricing_breakdown(
        line_items=row["line_items"],
        vendor_adjustments=row["vendor_adjustments"],
        service_fee_percent=5.0,
    )
    assert pb["client_total_gbp"] == 114.5
    label = _initial_client_total_label(row, pb)
    assert label == "GBP 94.50"


def test_client_booking_detail_model_keeps_initial_client_total_label():
    from app.contracts.booking import ClientBookingDetail

    detail = ClientBookingDetail(
        id="b1",
        status="pending",
        vendor_user_id="v1",
        vendor_display_name="Vendor",
        event_name="Test",
        event_date="2026-08-01",
        total_label="GBP 114.50",
        selected_option_ids=[],
        line_items=[],
        initial_client_total_label="GBP 94.50",
    )
    assert detail.initial_client_total_label == "GBP 94.50"


def test_initial_label_from_line_items_when_missing():
    row = {
        "initial_client_total_label": None,
        "line_items": [{"unit_price_gbp": 90.0}],
        "vendor_adjustments": [{"id": "a1", "tag": "other", "label": "setup", "amount_gbp": 20.0}],
    }
    pb = build_pricing_breakdown(
        line_items=row["line_items"],
        vendor_adjustments=row["vendor_adjustments"],
        service_fee_percent=5.0,
    )
    assert _initial_client_total_label(row, pb) == "GBP 94.50"
