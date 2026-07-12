"""Tests for admin payment field guards."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.admin.booking_payment_patch import patch_booking_payment_fields


@patch("app.features.admin.booking_payment_patch.get_client")
@patch("app.features.admin.booking_payment_patch.get_settings")
def test_payment_amount_requires_payment_intent(mock_settings, mock_get_client):
    mock_settings.return_value.local_auth_mode = False
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{}])
    with pytest.raises(ValueError, match="stripe_payment_intent_id"):
        patch_booking_payment_fields(
            "00000000-0000-4000-8000-000000000001",
            {"payment_amount_gbp": 99.0},
        )


@patch("app.features.admin.booking_payment_patch.stripe_service")
@patch("app.features.admin.booking_payment_patch.get_client")
@patch("app.features.admin.booking_payment_patch.get_settings")
def test_payment_amount_synced_from_stripe(mock_settings, mock_get_client, mock_stripe):
    mock_settings.return_value.local_auth_mode = False
    booking_id = "00000000-0000-4000-8000-000000000001"

    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"stripe_payment_intent_id": "pi_123"}])
    mock_table.update.return_value = mock_table

    mock_stripe.retrieve_payment_intent.return_value = {"amount_received": 52500}
    mock_stripe.stripe_object_to_dict.return_value = {"amount_received": 52500}

    ok = patch_booking_payment_fields(
        booking_id,
        {"payment_amount_gbp": 1.0, "stripe_payment_intent_id": "pi_123"},
    )
    assert ok is True
    update_call = mock_table.update.call_args[0][0]
    assert update_call["payment_amount_gbp"] == 525.0
