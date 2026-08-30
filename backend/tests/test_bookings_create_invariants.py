"""Client booking-create contract: IDs and event fields only — never prices."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.contracts.booking import CreateBookingRequestBody


def test_create_booking_body_rejects_client_supplied_line_items() -> None:
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        CreateBookingRequestBody(
            vendor_user_id="v1",
            event_name="Birthday dinner",
            event_date=date.today() + timedelta(days=14),
            selected_option_ids=["pkg-1"],
            line_items=[{"unit_price_gbp": 1}],
        )


def test_create_booking_body_has_no_price_fields() -> None:
    assert "line_items" not in CreateBookingRequestBody.model_fields
    assert "total_label" not in CreateBookingRequestBody.model_fields
    body = CreateBookingRequestBody(
        vendor_user_id="v1",
        event_name="Birthday dinner",
        event_date=date.today() + timedelta(days=14),
        selected_option_ids=["pkg-gold"],
    )
    dumped = body.model_dump()
    assert dumped["selected_option_ids"] == ["pkg-gold"]
    assert "line_items" not in dumped
    assert dumped.get("quantities") is None


def test_create_booking_body_allows_quantities() -> None:
    body = CreateBookingRequestBody(
        vendor_user_id="v1",
        event_name="Birthday dinner",
        event_date=date.today() + timedelta(days=14),
        selected_option_ids=["pkg-chairs"],
        quantities={"pkg-chairs": 50},
    )
    assert body.quantities == {"pkg-chairs": 50}


def test_create_booking_body_rejects_fractional_quantities() -> None:
    with pytest.raises(ValidationError):
        CreateBookingRequestBody(
            vendor_user_id="v1",
            event_name="Birthday dinner",
            event_date=date.today() + timedelta(days=14),
            selected_option_ids=["pkg-chairs"],
            quantities={"pkg-chairs": 1.5},
        )
