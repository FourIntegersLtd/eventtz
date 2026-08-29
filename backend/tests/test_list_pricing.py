"""Tests for vendor list pricing and automatic discounts."""

from __future__ import annotations

from datetime import date

import pytest

from app.core.errors import ValidationError
from app.features.vendors.list_pricing import (
    AUTO_BULK_LINE_ID,
    AUTO_OFF_PEAK_LINE_ID,
    SingleMoneyErrorKind,
    compute_automatic_discount_lines,
    is_off_peak_date,
    min_listing_price_gbp,
    parse_single_money_gbp,
    parse_vendor_discount_config,
    raise_if_invalid_single_money_gbp,
    resolve_line_items,
    sale_price_after_discount,
    validate_single_money_gbp,
    validate_single_money_gbp_kind,
)


def _vendor_payload(**overrides: object) -> dict:
    base = {
        "packages": [
            {
                "id": "pkg-gold",
                "title": "Gold package",
                "price": "500",
                "details": "Full coverage for your event including setup, service, and breakdown on the day.",
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


def test_parse_single_money_gbp_rejects_comma_prices():
    assert parse_single_money_gbp("150, 180") is None
    assert parse_single_money_gbp("150,180") is None
    err = validate_single_money_gbp("150, 180", "Package price", required=True)
    assert err and "one amount only" in err


def test_single_money_error_kind_mapping():
    assert validate_single_money_gbp_kind("150;180") is SingleMoneyErrorKind.MULTIPLE_AMOUNTS
    with pytest.raises(ValidationError, match="one amount only"):
        raise_if_invalid_single_money_gbp("150;180", "Package price", required=True)


def test_bulk_threshold_uses_strict_parse():
    config = parse_vendor_discount_config({"bulkDiscountThreshold": "150,180"})
    assert config.bulk_threshold is None
    config_ok = parse_vendor_discount_config({"bulkDiscountThreshold": "400"})
    assert config_ok.bulk_threshold == 400.0


def test_min_listing_price_ignores_invalid_package_price():
    payload = _vendor_payload(
        packages=[
            {
                "id": "pkg-bad",
                "title": "Chairs",
                "price": "150, 180",
                "details": "Thirty chairs and ten tables with delivery and collection included.",
                "duration": "2-hour hire",
            }
        ],
    )
    assert min_listing_price_gbp(payload) is None


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


def _per_unit_payload(**overrides: object) -> dict:
    base = {
        "packages": [
            {
                "id": "pkg-chairs",
                "title": "Chair hire",
                "price": "2",
                "details": "White folding chairs, 3-day hire, delivery and collection within 10 miles.",
                "duration": "3-day hire",
                "pricingMode": "per_unit",
                "unitLabel": "chair",
                "minQuantity": "10",
                "maxQuantity": "200",
            },
        ],
        "hourlyRate": "",
        "dailyRate": "",
        "offerDiscounts": False,
    }
    base.update(overrides)
    return base


def test_per_unit_missing_mode_defaults_to_fixed():
    payload = _vendor_payload()
    items = resolve_line_items(payload, ["pkg-gold"])
    assert items[0]["unit_price_gbp"] == 500.0
    assert "quantity" not in items[0]


def test_per_unit_multiplies_rate_by_quantity():
    payload = _per_unit_payload()
    items = resolve_line_items(payload, ["pkg-chairs"], {"pkg-chairs": 50})
    assert len(items) == 1
    assert items[0]["unit_price_gbp"] == 100.0
    assert items[0]["quantity"] == 50
    assert items[0]["unit_rate_gbp"] == 2.0
    assert items[0]["unit_label"] == "chair"


def test_per_unit_applies_headline_discount_to_unit_rate():
    payload = _per_unit_payload(offerDiscounts=True, discountPercentage="10")
    items = resolve_line_items(payload, ["pkg-chairs"], {"pkg-chairs": 50})
    assert items[0]["unit_rate_gbp"] == 1.8
    assert items[0]["unit_price_gbp"] == 90.0


def test_per_unit_requires_quantity():
    payload = _per_unit_payload()
    with pytest.raises(ValueError, match="how many"):
        resolve_line_items(payload, ["pkg-chairs"])


def test_per_unit_rejects_quantity_below_min():
    payload = _per_unit_payload()
    with pytest.raises(ValueError, match="between 10 and 200"):
        resolve_line_items(payload, ["pkg-chairs"], {"pkg-chairs": 5})


def test_per_unit_rejects_quantity_above_max():
    payload = _per_unit_payload()
    with pytest.raises(ValueError, match="between 10 and 200"):
        resolve_line_items(payload, ["pkg-chairs"], {"pkg-chairs": 201})


def test_min_listing_price_uses_per_unit_rate():
    payload = _per_unit_payload()
    assert min_listing_price_gbp(payload) == 2.0


def test_fixed_package_ignores_quantity():
    payload = _vendor_payload()
    items = resolve_line_items(payload, ["pkg-gold"], {"pkg-gold": 9})
    assert items[0]["unit_price_gbp"] == 500.0
    assert "quantity" not in items[0]
