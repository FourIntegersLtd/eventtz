"""Tests for booking list pending labels and price-update flags."""

from __future__ import annotations

from app.features.bookings.pricing_confirmation import client_price_confirmation_required
from app.features.bookings.queries import _has_price_update


def test_has_price_update_when_adjustments_present():
    row = {"vendor_adjustments": [{"amount_gbp": 25.0}]}
    assert _has_price_update(row) is True


def test_has_price_update_when_no_adjustments():
    row = {"vendor_adjustments": []}
    assert _has_price_update(row) is False


def test_client_price_confirmation_aligns_with_has_price_update():
    row = {
        "status": "pending",
        "initiator": "client",
        "vendor_adjustments": [{"amount_gbp": 10.0}],
    }
    assert _has_price_update(row) is True
    assert client_price_confirmation_required(row) is True
