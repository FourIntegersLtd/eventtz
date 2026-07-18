"""Accept booking requires Stripe Connect payouts ready."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings.status import (
    _vendor_payouts_ready,
    update_booking_request_status_for_vendor,
)


@patch("app.features.bookings.status.get_client")
def test_vendor_payouts_ready_requires_charges_and_payouts(mock_get_client):
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
                "stripe_account_id": "acct_1",
                "stripe_charges_enabled": True,
                "stripe_payouts_enabled": False,
            },
        ],
    )
    assert _vendor_payouts_ready("v1") is False

    mock_table.execute.return_value = MagicMock(
        data=[
            {
                "stripe_account_id": "acct_1",
                "stripe_charges_enabled": True,
                "stripe_payouts_enabled": True,
            },
        ],
    )
    assert _vendor_payouts_ready("v1") is True


@patch("app.features.bookings.status._vendor_payouts_ready", return_value=False)
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_vendor_cannot_accept_without_payouts_ready(mock_get_client, mock_settings, _mock_ready):
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
                "payment_status": "unpaid",
                "vendor_adjustments": [],
            },
        ],
    )

    with pytest.raises(ValueError, match="payout setup"):
        update_booking_request_status_for_vendor("v1", "b1", new_status="accepted")
