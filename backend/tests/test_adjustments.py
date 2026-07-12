"""Tests for vendor booking adjustment caps."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings.adjustments import _validate_adjustment_caps, put_vendor_booking_adjustments


def test_surcharge_over_single_cap_rejected():
    line_items = [{"unit_price_gbp": 1000.0}]
    stored = [{"amount_gbp": 60_000.0}]
    with pytest.raises(ValueError, match="surcharge"):
        _validate_adjustment_caps(line_items, stored)


def test_total_surcharge_pct_cap_rejected():
    line_items = [{"unit_price_gbp": 1000.0}]
    stored = [
        {"amount_gbp": 1500.0},
        {"amount_gbp": 600.0},
    ]
    with pytest.raises(ValueError, match="Total surcharges"):
        _validate_adjustment_caps(line_items, stored)


def test_discount_allowed():
    line_items = [{"unit_price_gbp": 1000.0}]
    stored = [{"amount_gbp": -200.0}]
    _validate_adjustment_caps(line_items, stored)


@patch("app.features.bookings.adjustments.get_settings")
@patch("app.features.bookings.adjustments.get_client")
def test_put_adjustments_rejects_zero_vendor_portion(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[
            {
                "id": "b1",
                "status": "pending",
                "line_items": [{"unit_price_gbp": 100.0}],
                "client_user_id": "c1",
                "initiator": "client",
            },
        ],
    )

    with pytest.raises(ValueError, match="zero or below"):
        put_vendor_booking_adjustments(
            "v1",
            "b1",
            [{"tag": "discount", "label": "Full discount", "amount_gbp": -100.0}],
        )


def test_total_surcharge_pct_uses_positive_line_subtotal():
    line_items = [{"unit_price_gbp": 500.0}, {"unit_price_gbp": -50.0}]
    stored = [{"amount_gbp": 1100.0}]
    with pytest.raises(ValueError, match="Total surcharges"):
        _validate_adjustment_caps(line_items, stored)
