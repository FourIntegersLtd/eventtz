"""Tests for cancellation guards and the full refund-on-cancel flow."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings import payments
from app.features.bookings.status import (
    cancel_booking_request_for_client,
    update_booking_request_status_for_vendor,
)


def _client_row(payment_status: str) -> dict:
    return {
        "id": "b1",
        "status": "accepted",
        "vendor_user_id": "v1",
        "payment_status": payment_status,
    }


def _vendor_row(payment_status: str) -> dict:
    return {
        "id": "b1",
        "status": "accepted",
        "client_user_id": "c1",
        "initiator": "client",
        "paid_at": None,
        "payment_status": payment_status,
        "vendor_adjustments": [],
    }


def _mock_db(row: dict) -> tuple[MagicMock, MagicMock]:
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    for m in ("select", "eq", "limit", "update", "in_"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.side_effect = [
        MagicMock(data=[row]),
        MagicMock(data=[{"id": "b1"}]),
    ]
    return mock_client, mock_table


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.dispatch_booking_notification")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_unpaid_client_cancel_skips_refund(
    mock_get_client, mock_settings, _notify, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    mock_client, mock_table = _mock_db(_client_row("unpaid"))
    mock_get_client.return_value = mock_client

    result = cancel_booking_request_for_client("c1", "b1")
    assert result == {"id": "b1", "status": "cancelled"}
    mock_refund.assert_not_called()
    update_payload = mock_table.update.call_args[0][0]
    assert update_payload["status"] == "cancelled"
    assert update_payload["cancelled_by"] == "client"
    assert update_payload["cancelled_at"]


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.dispatch_booking_notification")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_paid_client_cancel_refunds_first(
    mock_get_client, mock_settings, _notify, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    mock_client, _ = _mock_db(_client_row("paid"))
    mock_get_client.return_value = mock_client

    result = cancel_booking_request_for_client("c1", "b1")
    assert result == {"id": "b1", "status": "cancelled"}
    mock_refund.assert_called_once_with("b1", cancelled_by="client")


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.dispatch_booking_notification")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_refund_failure_leaves_booking_uncancelled(
    mock_get_client, mock_settings, _notify, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    mock_client, mock_table = _mock_db(_client_row("paid"))
    mock_get_client.return_value = mock_client
    mock_refund.side_effect = ValueError("We couldn't process the refund right now.")

    with pytest.raises(ValueError, match="refund"):
        cancel_booking_request_for_client("c1", "b1")
    mock_table.update.assert_not_called()


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_cancel_blocked_after_payout_released(
    mock_get_client, mock_settings, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    mock_client, mock_table = _mock_db(_client_row("payout_released"))
    mock_get_client.return_value = mock_client

    with pytest.raises(ValueError, match="already been paid"):
        cancel_booking_request_for_client("c1", "b1")
    mock_refund.assert_not_called()
    mock_table.update.assert_not_called()


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=True)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_cancel_blocked_while_dispute_open(
    mock_get_client, mock_settings, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    mock_client, mock_table = _mock_db(_client_row("paid"))
    mock_get_client.return_value = mock_client

    with pytest.raises(ValueError, match="problem report"):
        cancel_booking_request_for_client("c1", "b1")
    mock_refund.assert_not_called()
    mock_table.update.assert_not_called()


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.dispatch_booking_notification")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_paid_vendor_cancel_refunds_client(
    mock_get_client, mock_settings, _notify, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    mock_client, mock_table = _mock_db(_vendor_row("paid"))
    mock_get_client.return_value = mock_client

    result = update_booking_request_status_for_vendor("v1", "b1", new_status="cancelled")
    assert result == {"id": "b1", "status": "cancelled"}
    mock_refund.assert_called_once_with("b1", cancelled_by="vendor")
    update_payload = mock_table.update.call_args[0][0]
    assert update_payload["cancelled_by"] == "vendor"


@patch("app.features.bookings.payments._notify_pair")
@patch("app.features.bookings.payments.dispatch_booking_notification")
@patch("app.features.bookings.payments.stripe_service.create_refund")
@patch("app.features.bookings.payments.get_settings")
@patch("app.features.bookings.payments.get_client")
def test_refund_on_cancel_issues_full_stripe_refund(
    mock_get_client, mock_settings, mock_create_refund, _upsert, _notify,
):
    mock_settings.return_value.local_auth_mode = False
    mock_table = MagicMock()
    mock_get_client.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit", "update"):
        getattr(mock_table, m).return_value = mock_table
    row = {
        "id": "b1",
        "payment_status": "paid",
        "stripe_payment_intent_id": "pi_1",
        "client_user_id": "c1",
        "vendor_user_id": "v1",
    }
    mock_table.execute.side_effect = [
        MagicMock(data=[row]),
        MagicMock(data=[{**row, "payment_status": "refunded"}]),
    ]

    result = payments.refund_booking_on_cancel("b1", cancelled_by="client")
    assert result["payment_status"] == "refunded"
    kwargs = mock_create_refund.call_args.kwargs
    assert kwargs["amount_gbp"] is None
    assert kwargs["idempotency_suffix"] == "cancel-client"


@patch("app.features.bookings.payments.stripe_service.create_refund", side_effect=RuntimeError("stripe down"))
@patch("app.features.bookings.payments.get_settings")
@patch("app.features.bookings.payments.get_client")
def test_refund_on_cancel_raises_when_stripe_fails(
    mock_get_client, mock_settings, _create_refund,
):
    mock_settings.return_value.local_auth_mode = False
    mock_table = MagicMock()
    mock_get_client.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[{"id": "b1", "payment_status": "paid", "stripe_payment_intent_id": "pi_1"}],
    )

    with pytest.raises(ValueError, match="refund"):
        payments.refund_booking_on_cancel("b1", cancelled_by="client")
    mock_table.update.assert_not_called()


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_cancel_blocked_when_completed(
    mock_get_client, mock_settings, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    row = _client_row("paid")
    row["status"] = "completed"
    mock_client, mock_table = _mock_db(row)
    mock_get_client.return_value = mock_client

    with pytest.raises(ValueError, match="already complete"):
        cancel_booking_request_for_client("c1", "b1")
    mock_refund.assert_not_called()
    mock_table.update.assert_not_called()


@patch("app.features.bookings.payments.refund_booking_on_cancel")
@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.status._notify_booking_changed")
@patch("app.features.bookings.status.dispatch_booking_notification")
@patch("app.features.bookings.status.get_settings")
@patch("app.features.bookings.status.get_client")
def test_cancel_retry_after_refund_skips_stripe(
    mock_get_client, mock_settings, _notify, _sse, _dispute, mock_refund,
):
    mock_settings.return_value.local_auth_mode = False
    row = _client_row("refunded")
    mock_client, mock_table = _mock_db(row)
    mock_get_client.return_value = mock_client

    result = cancel_booking_request_for_client("c1", "b1")
    assert result == {"id": "b1", "status": "cancelled"}
    mock_refund.assert_not_called()
    update_payload = mock_table.update.call_args[0][0]
    assert update_payload["status"] == "cancelled"


@patch("app.features.bookings.payments.get_client")
def test_finalize_skips_cancelled_booking(mock_get_client):
    mock_table = MagicMock()
    mock_get_client.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit", "update", "in_"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[
            {
                "stripe_checkout_session_id": "cs_1",
                "payment_status": "pending",
                "status": "cancelled",
            },
        ],
    )
    session = {
        "id": "cs_1",
        "amount_total": 10000,
        "metadata": {
            "booking_id": "b1",
            "client_total_gbp": "100",
            "vendor_amount_gbp": "90",
            "service_fee_gbp": "10",
        },
    }
    assert payments._finalize_booking_payment_from_checkout_session(session) is False
    mock_table.update.assert_not_called()


@patch("app.features.bookings.payments._finalize_booking_payment_from_checkout_session")
@patch("app.features.bookings.payments.get_booking_request_for_client")
@patch("app.features.bookings.payments.get_settings")
def test_sync_rejects_cancelled_booking(
    mock_settings, mock_get_booking, mock_finalize,
):
    mock_settings.return_value.local_auth_mode = False
    mock_get_booking.return_value = {
        "id": "b1",
        "status": "cancelled",
        "payment_status": "pending",
    }

    with pytest.raises(ValueError, match="no longer be paid"):
        payments.sync_checkout_payment_for_client("c1", "b1", session_id="cs_1")
    mock_finalize.assert_not_called()
