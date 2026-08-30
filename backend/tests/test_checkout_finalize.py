"""Tests for checkout payment finalization guards."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.features.bookings.payments import _finalize_booking_payment_from_checkout_session


def _session(*, session_id: str, amount_pence: int, booking_id: str = "b1") -> dict:
    return {
        "id": session_id,
        "amount_total": amount_pence,
        "metadata": {
            "booking_id": booking_id,
            "client_total_gbp": f"{amount_pence / 100:.2f}",
            "vendor_amount_gbp": "500.00",
            "service_fee_gbp": "25.00",
        },
        "payment_intent": "pi_test",
    }


@patch("app.features.bookings.payment_finalize.refund_checkout_payment")
@patch("app.features.bookings.payment_finalize.get_db")
def test_rejects_stale_checkout_session(mock_get_client, mock_refund):
    mock_db = MagicMock()
    mock_get_client.return_value = mock_db
    mock_table = MagicMock()
    mock_db.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[{"stripe_checkout_session_id": "cs_current", "payment_status": "pending", "status": "accepted"}],
    )

    ok = _finalize_booking_payment_from_checkout_session(_session(session_id="cs_old", amount_pence=52500))
    assert ok is False
    mock_refund.assert_called_once_with(
        _session(session_id="cs_old", amount_pence=52500),
        "b1",
        idempotency_suffix="stale-checkout-session",
    )


@patch("app.features.bookings.payment_finalize._payment_fields_from_checkout_session", return_value=("pi_test", "ch_test"))
@patch("app.features.bookings.payment_finalize.get_db")
def test_rejects_amount_mismatch(mock_get_client, _pi_fields):
    mock_db = MagicMock()
    mock_get_client.return_value = mock_db
    mock_table = MagicMock()
    mock_db.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[{"stripe_checkout_session_id": "cs_1", "payment_status": "pending", "status": "accepted"}],
    )

    session = {
        "id": "cs_1",
        "amount_total": 100,
        "metadata": {
            "booking_id": "b1",
            "client_total_gbp": "525.00",
            "vendor_amount_gbp": "500.00",
            "service_fee_gbp": "25.00",
        },
        "payment_intent": "pi_test",
    }
    ok = _finalize_booking_payment_from_checkout_session(session)
    assert ok is False
    mock_table.update.assert_not_called()


@patch("app.features.bookings.receipts.persist_payment_receipt_snapshots")
@patch("app.features.bookings.receipts.dispatch_payment_receipts_after_checkout")
@patch("app.features.bookings.booking_payment_helpers._notify_pair")
@patch("app.features.bookings.payment_finalize.dispatch_booking_notification")
@patch("app.features.bookings.payment_finalize._payment_fields_from_checkout_session", return_value=("pi_test", "ch_test"))
@patch("app.features.bookings.payment_finalize.get_db")
def test_accepts_matching_current_session(
    mock_get_client,
    _pi_fields,
    _notify,
    _upsert,
    _dispatch_receipts,
    _persist_snapshots,
):
    mock_db = MagicMock()
    mock_get_client.return_value = mock_db
    mock_table = MagicMock()
    mock_db.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.in_.return_value = mock_table
    mock_table.execute.side_effect = [
        MagicMock(data=[{"stripe_checkout_session_id": "cs_1", "payment_status": "pending", "status": "accepted"}]),
        MagicMock(data=[{"id": "b1", "client_user_id": "c1", "vendor_user_id": "v1"}]),
    ]

    ok = _finalize_booking_payment_from_checkout_session(_session(session_id="cs_1", amount_pence=52500))
    assert ok is True
    update_payload = mock_table.update.call_args[0][0]
    assert update_payload["payment_amount_gbp"] == 525.0


@patch("app.features.bookings.payment_finalize.stripe_service.charge_receipt_url", return_value=None)
@patch("app.features.bookings.payment_finalize.refund_checkout_payment")
@patch("app.features.bookings.payment_finalize._payment_fields_from_checkout_session", return_value=("pi_test", "ch_test"))
@patch("app.features.bookings.payment_finalize.get_db")
def test_refunds_when_finalize_update_empty_and_booking_cancelled(
    mock_get_client, _pi_fields, mock_refund, _receipt_url,
):
    mock_db = MagicMock()
    mock_get_client.return_value = mock_db
    mock_table = MagicMock()
    mock_db.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.in_.return_value = mock_table
    mock_table.update.return_value = mock_table
    empty_update = MagicMock()
    empty_update.data = []
    mock_table.execute.side_effect = [
        MagicMock(data=[{"stripe_checkout_session_id": "cs_1", "payment_status": "pending", "status": "accepted"}]),
        empty_update,
        MagicMock(data=[{"status": "cancelled", "payment_status": "pending"}]),
    ]

    session = _session(session_id="cs_1", amount_pence=52500)
    ok = _finalize_booking_payment_from_checkout_session(session)
    assert ok is False
    mock_refund.assert_called_once_with(session, "b1", idempotency_suffix="checkout-not-eligible")


@patch("app.features.bookings.payment_finalize.stripe_service.charge_receipt_url", return_value=None)
@patch("app.features.bookings.payment_finalize.refund_checkout_payment")
@patch("app.features.bookings.payment_finalize._payment_fields_from_checkout_session", return_value=("pi_test", "ch_test"))
@patch("app.features.bookings.payment_finalize.get_db")
def test_skips_refund_when_finalize_update_empty_but_already_paid(
    mock_get_client, _pi_fields, mock_refund, _receipt_url,
):
    mock_db = MagicMock()
    mock_get_client.return_value = mock_db
    mock_table = MagicMock()
    mock_db.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.in_.return_value = mock_table
    mock_table.update.return_value = mock_table
    empty_update = MagicMock()
    empty_update.data = []
    mock_table.execute.side_effect = [
        MagicMock(data=[{"stripe_checkout_session_id": "cs_1", "payment_status": "pending", "status": "accepted"}]),
        empty_update,
        MagicMock(data=[{"status": "accepted", "payment_status": "paid"}]),
    ]

    ok = _finalize_booking_payment_from_checkout_session(_session(session_id="cs_1", amount_pence=52500))
    assert ok is False
    mock_refund.assert_not_called()
