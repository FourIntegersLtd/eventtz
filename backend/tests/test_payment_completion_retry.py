"""Retry vendor payout when both parties confirmed but Transfer failed."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings.payment_completion import confirm_completion_for_vendor


def _paid_both_confirmed_row() -> dict:
    return {
        "id": "booking-1",
        "status": "accepted",
        "payment_status": "paid",
        "client_user_id": "client-1",
        "vendor_user_id": "vendor-1",
        "client_completion_confirmed_at": "2026-08-09T18:00:00+00:00",
        "vendor_completion_confirmed_at": "2026-08-09T19:00:00+00:00",
        "vendor_amount_gbp": 100.0,
        "stripe_charge_id": "ch_test123",
    }


@patch("app.features.bookings.payment_completion.get_settings")
@patch("app.features.bookings.payment_completion.get_db")
@patch("app.features.bookings.payment_completion._finalize_completion")
def test_confirm_completion_retries_stuck_payout_when_vendor_already_confirmed(
    mock_finalize: MagicMock,
    mock_get_client: MagicMock,
    mock_settings: MagicMock,
) -> None:
    row = _paid_both_confirmed_row()
    mock_get_client.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[row],
    )
    mock_finalize.return_value = {
        "id": "booking-1",
        "status": "completed",
        "payment_status": "payout_released",
        "awaiting_other_party": False,
    }

    result = confirm_completion_for_vendor("vendor-1", "booking-1")

    assert result is not None
    assert result["payment_status"] == "payout_released"
    mock_finalize.assert_called_once_with(row)


@patch("app.features.bookings.payment_completion.get_settings")
@patch("app.features.bookings.payment_completion.get_db")
@patch("app.features.bookings.payment_completion._finalize_completion")
def test_confirm_completion_surfaces_transfer_failure_on_retry(
    mock_finalize: MagicMock,
    mock_get_client: MagicMock,
    mock_settings: MagicMock,
) -> None:
    row = _paid_both_confirmed_row()
    mock_get_client.return_value.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[row],
    )
    mock_finalize.side_effect = ValueError("We couldn't release the payout right now. Please try again shortly.")

    with pytest.raises(ValueError, match="couldn't release the payout"):
        confirm_completion_for_vendor("vendor-1", "booking-1")
