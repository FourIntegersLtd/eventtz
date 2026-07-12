"""Tests for vendor quote line item validation."""

from __future__ import annotations

import pytest

from app.features.bookings.line_item_validation import validate_quote_line_items


def test_valid_quote_lines():
    out = validate_quote_line_items(
        [{"heading": "Day rate", "unit_price_gbp": 500.0}],
    )
    assert out[0]["unit_price_gbp"] == 500.0


def test_rejects_zero_price():
    with pytest.raises(ValueError, match="at least"):
        validate_quote_line_items([{"heading": "Free", "unit_price_gbp": 0}])


def test_rejects_negative_price():
    with pytest.raises(ValueError, match="at least"):
        validate_quote_line_items([{"heading": "Bad", "unit_price_gbp": -10}])


def test_rejects_over_cap():
    with pytest.raises(ValueError, match="too high"):
        validate_quote_line_items([{"heading": "Huge", "unit_price_gbp": 2_000_000}])


def test_rejects_too_many_lines():
    lines = [{"heading": f"Line {i}", "unit_price_gbp": 10.0} for i in range(26)]
    with pytest.raises(ValueError, match="more than"):
        validate_quote_line_items(lines)


def test_rejects_nan_price():
    with pytest.raises(ValueError, match="valid price"):
        validate_quote_line_items([{"heading": "Bad", "unit_price_gbp": float("nan")}])
