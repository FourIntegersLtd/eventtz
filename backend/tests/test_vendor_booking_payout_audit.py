"""Vendor booking cancel-during-checkout, stale-checkout refund, and completion gates."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings.payment_completion import (
    confirm_completion_for_client,
    confirm_completion_for_vendor,
    release_vendor_payout_and_complete_booking,
)
from app.features.bookings.payment_finalize import _finalize_booking_payment_from_checkout_session
from app.features.bookings.status import (
    cancel_booking_request_for_client,
    update_booking_request_status_for_vendor,
)


def _vendor_accepted_row(*, payment_status: str, checkout_session_id: str | None = "cs_live") -> dict:
    return {
        "id": "b1",
        "status": "accepted",
        "client_user_id": "c1",
        "initiator": "client",
        "paid_at": None,
        "payment_status": payment_status,
        "vendor_adjustments": [],
        "stripe_checkout_session_id": checkout_session_id,
    }


@patch("app.features.payments.stripe.expire_checkout_session")
@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status_vendor._notify_booking_changed")
@patch("app.features.bookings.status_vendor.dispatch_booking_notification")
@patch("app.features.bookings.status_vendor.get_db")
def test_vendor_cancel_while_checkout_pending_expires_session(
    mock_get_db,
    _notify,
    _dispatch,
    _dispute,
    mock_refund,
    mock_expire,
):
    row = _vendor_accepted_row(payment_status="pending")
    mock_table = MagicMock()
    mock_get_db.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit", "update"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.side_effect = [MagicMock(data=[row]), MagicMock(data=[{"id": "b1"}])]

    result = update_booking_request_status_for_vendor("v1", "b1", new_status="cancelled")
    assert result == {"id": "b1", "status": "cancelled"}
    mock_expire.assert_called_once_with("cs_live")
    mock_refund.assert_not_called()


@patch("app.features.payments.stripe.expire_checkout_session")
@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status_client._notify_booking_changed")
@patch("app.features.bookings.status_client.dispatch_booking_notification")
@patch("app.features.bookings.status_client.get_db")
def test_client_cancel_while_checkout_pending_expires_session(
    mock_get_db,
    _notify,
    _dispatch,
    _dispute,
    mock_refund,
    mock_expire,
):
    row = {
        "id": "b1",
        "status": "accepted",
        "client_user_id": "c1",
        "vendor_user_id": "v1",
        "payment_status": "pending",
        "stripe_checkout_session_id": "cs_live",
    }
    mock_table = MagicMock()
    mock_get_db.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit", "update", "in_"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.side_effect = [MagicMock(data=[row]), MagicMock(data=[{"id": "b1"}])]

    result = cancel_booking_request_for_client("c1", "b1")
    assert result == {"id": "b1", "status": "cancelled"}
    mock_expire.assert_called_once_with("cs_live")
    mock_refund.assert_not_called()


@patch("app.features.bookings.payment_finalize.stripe_service.create_refund")
@patch("app.features.bookings.payment_finalize.get_db")
def test_checkout_webhook_refunds_when_booking_no_longer_accepted(mock_get_db, mock_refund):
    mock_table = MagicMock()
    mock_get_db.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit", "update", "in_"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[{"stripe_checkout_session_id": "cs_1", "payment_status": "pending", "status": "cancelled"}],
    )
    session = {
        "id": "cs_1",
        "amount_total": 52500,
        "metadata": {
            "booking_id": "b1",
            "client_total_gbp": "525.00",
            "vendor_amount_gbp": "500.00",
            "service_fee_gbp": "25.00",
        },
        "payment_intent": "pi_stale",
    }

    ok = _finalize_booking_payment_from_checkout_session(session)
    assert ok is False
    mock_refund.assert_called_once()
    assert mock_refund.call_args.kwargs["payment_intent_id"] == "pi_stale"


@patch("app.features.bookings.payment_completion.dispatch_booking_notification")
@patch("app.features.bookings.payment_completion._load_full_booking_row")
@patch("app.features.bookings.payment_completion.stripe_service.create_transfer", return_value="tr_1")
@patch("app.features.bookings.payment_completion._get_vendor_stripe_fields")
@patch("app.features.bookings.payment_completion.get_db")
def test_already_released_payout_does_not_renotify(
    mock_get_db,
    mock_stripe_fields,
    _transfer,
    mock_load,
    mock_notify,
):
    mock_stripe_fields.return_value = {
        "stripe_account_id": "acct_1",
        "stripe_payouts_enabled": True,
    }
    paid_row = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "paid",
        "client_user_id": "c1",
        "vendor_user_id": "v1",
        "vendor_amount_gbp": 100.0,
        "stripe_charge_id": "ch_1",
        "stripe_payment_intent_id": "pi_1",
        "payment_amount_gbp": 120.0,
    }
    released_row = {**paid_row, "status": "completed", "payment_status": "payout_released"}
    mock_load.side_effect = [paid_row, released_row]
    mock_table = MagicMock()
    mock_get_db.return_value.table.return_value = mock_table
    for m in ("update", "eq"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])

    result = release_vendor_payout_and_complete_booking(paid_row)
    assert result["payment_status"] == "payout_released"
    mock_notify.assert_not_called()


@patch("app.features.bookings.payment_completion.get_db")
def test_confirm_completion_rejected_before_event_day_over(mock_get_db):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    row = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "paid",
        "event_date": tomorrow,
        "event_end_date": None,
        "client_completion_confirmed_at": None,
        "vendor_completion_confirmed_at": None,
        "client_user_id": "c1",
        "vendor_user_id": "v1",
    }
    mock_table = MagicMock()
    mock_get_db.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[row])

    with pytest.raises(ValueError, match="event day"):
        confirm_completion_for_vendor("v1", "b1")


@patch("app.features.bookings.payment_completion.get_db")
def test_client_confirm_completion_rejected_before_event_day_over(mock_get_db):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    row = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "paid",
        "event_date": tomorrow,
        "event_end_date": None,
        "client_completion_confirmed_at": None,
        "vendor_completion_confirmed_at": None,
        "client_user_id": "c1",
        "vendor_user_id": "v1",
    }
    mock_table = MagicMock()
    mock_get_db.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[row])

    with pytest.raises(ValueError, match="event day"):
        confirm_completion_for_client("c1", "b1")
