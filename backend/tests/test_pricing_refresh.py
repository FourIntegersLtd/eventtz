"""Tests for checkout-time booking pricing refresh."""

from __future__ import annotations

from datetime import date

import pytest

from app.features.bookings.pricing_refresh import refresh_booking_pricing
from app.features.vendors.list_pricing import AUTO_BULK_LINE_ID


def _vendor_payload(**overrides: object) -> dict:
    base = {
        "packages": [{"id": "pkg-gold", "title": "Gold", "price": "500"}],
        "offerDiscounts": True,
        "bulkDiscountThreshold": "400",
        "bulkDiscountPercent": "10",
    }
    base.update(overrides)
    return base


def test_refresh_recomputes_stale_auto_discount():
    row = {
        "event_date": "2026-07-15",
        "line_items": [
            {"id": "pkg-gold", "heading": "Gold", "unit_price_gbp": 500.0},
            {"id": AUTO_BULK_LINE_ID, "heading": "Bulk", "unit_price_gbp": -999.0},
        ],
        "vendor_adjustments": [],
    }
    out = refresh_booking_pricing(row, _vendor_payload())
    auto = [li for li in out["line_items"] if li.get("id") == AUTO_BULK_LINE_ID]
    assert len(auto) == 1
    assert auto[0]["unit_price_gbp"] == -50.0
    assert out["total_label"]
    assert float(out["pricing_breakdown"]["vendor_portion_gbp"]) > 0


def test_refresh_rejects_zero_vendor_portion():
    row = {
        "event_date": "2026-07-15",
        "line_items": [{"id": "x", "heading": "Free", "unit_price_gbp": 0.0}],
        "vendor_adjustments": [],
    }
    with pytest.raises(ValueError, match="Nothing to pay"):
        refresh_booking_pricing(row, _vendor_payload())
