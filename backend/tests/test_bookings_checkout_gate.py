"""Checkout is allowed only for accepted unpaid/pending bookings."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings import messages as booking_messages
from app.features.bookings.payment_checkout import create_checkout_session_for_booking


def _booking_row(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "unpaid",
        "client_user_id": "c1",
        "vendor_user_id": "v1",
        "event_name": "Party",
        "line_items": [],
        "event_address": "12 Park Lane",
    }
    row.update(overrides)
    return row


def _mock_db_with_row(row: dict[str, object] | None) -> MagicMock:
    db = MagicMock()
    table = MagicMock()
    db.table.return_value = table
    table.select.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.limit.return_value = table
    table.execute.return_value = MagicMock(data=[row] if row else [])
    return db


@patch("app.features.bookings.payment_checkout.get_db")
def test_checkout_rejects_pending_booking(mock_get_db: MagicMock) -> None:
    mock_get_db.return_value = _mock_db_with_row(_booking_row(status="pending"))
    with pytest.raises(ValueError, match=booking_messages.ONLY_ACCEPTED_CAN_BE_PAID):
        create_checkout_session_for_booking("c1", "b1")


@patch("app.features.bookings.payment_checkout.refresh_booking_pricing")
@patch("app.features.bookings.payment_checkout.get_bookable_vendor_profile_form_data")
@patch("app.features.bookings.payment_checkout._get_vendor_stripe_fields")
@patch("app.features.bookings.payment_checkout.get_db")
def test_checkout_rejects_missing_event_address(
    mock_get_db: MagicMock,
    mock_vendor_stripe: MagicMock,
    mock_vendor_payload: MagicMock,
    mock_refresh: MagicMock,
) -> None:
    mock_get_db.return_value = _mock_db_with_row(_booking_row(event_address=""))
    mock_vendor_stripe.return_value = {
        "stripe_account_id": "acct_test",
        "stripe_charges_enabled": True,
    }
    mock_vendor_payload.return_value = {"packages": []}
    mock_refresh.return_value = {
        "line_items": [],
        "total_label": "GBP 100",
        "pricing_breakdown": {
            "client_total_gbp": 100.0,
            "vendor_portion_gbp": 90.0,
            "service_fee_gbp": 10.0,
        },
    }
    with pytest.raises(ValueError, match=booking_messages.ADD_EVENT_ADDRESS_BEFORE_PAY):
        create_checkout_session_for_booking("c1", "b1")


@patch("app.features.bookings.payment_checkout.get_db")
def test_checkout_rejects_already_paid_booking(mock_get_db: MagicMock) -> None:
    mock_get_db.return_value = _mock_db_with_row(_booking_row(payment_status="paid"))
    with pytest.raises(ValueError, match=booking_messages.BOOKING_ALREADY_PAID):
        create_checkout_session_for_booking("c1", "b1")
