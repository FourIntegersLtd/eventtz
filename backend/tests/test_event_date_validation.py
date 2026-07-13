"""Tests for event date validation on booking request bodies."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.contracts.booking import CreateBookingRequestBody, CreateVendorQuoteBody


def test_create_booking_rejects_past_event_date():
    past = date.today() - timedelta(days=1)
    with pytest.raises(ValidationError, match="cannot be in the past"):
        CreateBookingRequestBody(
            vendor_user_id="v1",
            event_name="Naming ceremony",
            event_date=past,
            selected_option_ids=["pkg-1"],
        )


def test_create_booking_allows_today():
    today = date.today()
    body = CreateBookingRequestBody(
        vendor_user_id="v1",
        event_name="Naming ceremony",
        event_date=today,
        selected_option_ids=["pkg-1"],
    )
    assert body.event_date == today


def test_vendor_quote_rejects_past_event_date():
    past = date.today() - timedelta(days=3)
    with pytest.raises(ValidationError, match="cannot be in the past"):
        CreateVendorQuoteBody(
            client_user_id="c1",
            event_name="Wedding",
            event_date=past,
            line_items=[{"id": "li-1", "heading": "Package", "unit_price_gbp": 500.0}],
        )
