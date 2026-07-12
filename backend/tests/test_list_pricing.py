"""Tests for vendor list pricing and automatic discounts."""

from __future__ import annotations

from datetime import date

import pytest

from app.features.vendors.list_pricing import (
    AUTO_BULK_LINE_ID,
    AUTO_OFF_PEAK_LINE_ID,
    compute_automatic_discount_lines,
    is_off_peak_date,
    min_listing_price_gbp,
    resolve_line_items,
    sale_price_after_discount,
)


def _vendor_payload(**overrides: object) -> dict:
    base = {
        "packages": [
            {
                "id": "pkg-gold",
                "title": "Gold package",
                "price": "500",
                "details": "Full coverage",
                "duration": "8 hr",
            },
        ],
        "hourlyRate": "",
        "dailyRate": "",
        "offerDiscounts": False,
    }
    base.update(overrides)
    return base


def test_sale_price_after_discount():
    assert sale_price_after_discount(500, 10) == 450.0


def test_main_discount_on_resolve():
    payload = _vendor_payload(offerDiscounts=True, discountPercentage="10")
    items = resolve_line_items(payload, ["pkg-gold"])
    assert len(items) == 1
    assert items[0]["unit_price_gbp"] == 450.0
    assert items[0]["heading"] == "Gold package"


def test_bulk_discount_line():
    payload = _vendor_payload(
        offerDiscounts=True,
        bulkDiscountThreshold="400",
        bulkDiscountPercent="10",
    )
    line_items = resolve_line_items(payload, ["pkg-gold"])
    auto = compute_automatic_discount_lines(payload, line_items, date(2026, 7, 15))
    assert len(auto) == 1
    assert auto[0]["id"] == AUTO_BULK_LINE_ID
    assert auto[0]["unit_price_gbp"] == -50.0


def test_off_peak_discount_line():
    payload = _vendor_payload(
        offerDiscounts=True,
        offPeakDiscountPercent="5",
    )
    line_items = resolve_line_items(payload, ["pkg-gold"])
    auto = compute_automatic_discount_lines(payload, line_items, date(2026, 1, 15))
    assert len(auto) == 1
    assert auto[0]["id"] == AUTO_OFF_PEAK_LINE_ID
    assert auto[0]["unit_price_gbp"] == -25.0


def test_off_peak_skipped_in_july():
    payload = _vendor_payload(
        offerDiscounts=True,
        offPeakDiscountPercent="5",
    )
    line_items = resolve_line_items(payload, ["pkg-gold"])
    auto = compute_automatic_discount_lines(payload, line_items, date(2026, 7, 15))
    assert auto == []


def test_bulk_and_off_peak_stack():
    payload = _vendor_payload(
        offerDiscounts=True,
        bulkDiscountThreshold="400",
        bulkDiscountPercent="10",
        offPeakDiscountPercent="5",
    )
    line_items = resolve_line_items(payload, ["pkg-gold"])
    auto = compute_automatic_discount_lines(payload, line_items, date(2026, 1, 15))
    assert len(auto) == 2
    assert auto[0]["id"] == AUTO_BULK_LINE_ID
    assert auto[0]["unit_price_gbp"] == -50.0
    assert auto[1]["id"] == AUTO_OFF_PEAK_LINE_ID
    assert auto[1]["unit_price_gbp"] == -22.5


def test_is_off_peak_date():
    assert is_off_peak_date(date(2026, 11, 1)) is True
    assert is_off_peak_date(date(2026, 2, 28)) is True
    assert is_off_peak_date(date(2026, 3, 1)) is False
    assert is_off_peak_date(date(2026, 7, 1)) is False


def test_invalid_option_id_raises():
    payload = _vendor_payload()
    with pytest.raises(ValueError, match="no longer available"):
        resolve_line_items(payload, ["unknown-id"])


def test_quote_only_vendor():
    payload = {
        "packages": [],
        "hourlyRate": "",
        "dailyRate": "",
    }
    items = resolve_line_items(payload, ["quote"])
    assert len(items) == 1
    assert items[0]["id"] == "quote"
    assert items[0]["unit_price_gbp"] is None


def test_hourly_fallback_when_no_packages():
    payload = {
        "packages": [],
        "hourlyRate": "80",
        "dailyRate": "",
        "offerDiscounts": True,
        "discountPercentage": "10",
    }
    items = resolve_line_items(payload, ["fixed-hourly"])
    assert items[0]["unit_price_gbp"] == 72.0


def test_min_listing_price_with_main_discount():
    payload = _vendor_payload(offerDiscounts=True, discountPercentage="10")
    assert min_listing_price_gbp(payload) == 450.0


def test_duplicate_selection_raises():
    payload = _vendor_payload()
    with pytest.raises(ValueError, match="Duplicate"):
        resolve_line_items(payload, ["pkg-gold", "pkg-gold"])


def test_strip_automatic_discount_lines():
    from app.features.vendors.list_pricing import strip_automatic_discount_lines

    items = [
        {"id": "pkg-gold", "unit_price_gbp": 500.0},
        {"id": AUTO_BULK_LINE_ID, "unit_price_gbp": -50.0},
        {"id": AUTO_OFF_PEAK_LINE_ID, "unit_price_gbp": -25.0},
    ]
    stripped = strip_automatic_discount_lines(items)
    assert len(stripped) == 1
    assert stripped[0]["id"] == "pkg-gold"


def test_reconcile_automatic_discount_lines_refreshes_bulk():
    from app.features.vendors.list_pricing import reconcile_automatic_discount_lines

    payload = _vendor_payload(
        offerDiscounts=True,
        bulkDiscountThreshold="400",
        bulkDiscountPercent="10",
    )
    stale = [
        {"id": "pkg-gold", "unit_price_gbp": 500.0},
        {"id": AUTO_BULK_LINE_ID, "unit_price_gbp": -999.0},
    ]
    out = reconcile_automatic_discount_lines(stale, payload, date(2026, 7, 15))
    auto = [li for li in out if str(li.get("id", "")).startswith("auto-")]
    assert len(auto) == 1
    assert auto[0]["id"] == AUTO_BULK_LINE_ID
    assert auto[0]["unit_price_gbp"] == -50.0
