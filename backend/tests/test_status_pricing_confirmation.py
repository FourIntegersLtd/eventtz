"""Tests for client price confirmation on updated booking requests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings.pricing_confirmation import client_price_confirmation_required
from app.features.bookings.status import (
    update_booking_request_status_for_client,
    update_booking_request_status_for_vendor,
)


def test_client_price_confirmation_required_when_adjustments_present():
    row = {
        "status": "pending",
        "initiator": "client",
        "vendor_adjustments": [{"amount_gbp": 50.0}],
    }
    assert client_price_confirmation_required(row) is True


def test_client_price_confirmation_not_required_without_adjustments():
    row = {"status": "pending", "initiator": "client", "vendor_adjustments": []}
    assert client_price_confirmation_required(row) is False


@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_vendor_cannot_accept_while_client_must_confirm_price(mock_get_client, mock_settings):
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
                "client_user_id": "c1",
                "initiator": "client",
                "paid_at": None,
                "vendor_adjustments": [{"amount_gbp": 25.0}],
            },
        ],
    )

    with pytest.raises(ValueError, match="client must confirm"):
        update_booking_request_status_for_vendor("v1", "b1", new_status="accepted")


@patch("app.features.bookings.status.get_booking_request_for_vendor")
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.upsert_booking_notification")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_client_can_accept_updated_price(
    mock_get_client,
    mock_settings,
    mock_notify,
    mock_sse,
    mock_get_detail,
):
    mock_settings.return_value.local_auth_mode = False
    mock_get_detail.return_value = {
        "total_label": "GBP 520",
        "pricing": {"client_total_label": "GBP 520"},
    }
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.execute.side_effect = [
        MagicMock(
            data=[
                {
                    "id": "b1",
                    "status": "pending",
                    "vendor_user_id": "v1",
                    "initiator": "client",
                    "vendor_adjustments": [{"amount_gbp": 30.0}],
                },
            ],
        ),
        MagicMock(data=[{"id": "b1"}]),
    ]

    result = update_booking_request_status_for_client("c1", "b1", new_status="accepted")
    assert result == {"id": "b1", "status": "accepted"}
    mock_notify.assert_called_once()
