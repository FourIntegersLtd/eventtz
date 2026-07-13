"""Tests for admin booking support diagnostics."""

from unittest.mock import patch

from app.features.admin.booking_diagnostics import (
    compute_admin_booking_support_meta,
    summarize_support_for_booking_rows,
)


@patch("app.features.admin.booking_diagnostics.has_active_dispute_for_booking", return_value=False)
@patch("app.features.admin.booking_diagnostics._get_vendor_stripe_fields")
@patch("app.features.admin.booking_diagnostics._open_dispute_for_booking", return_value=None)
def test_flags_payment_not_marked_paid(mock_dispute, mock_vendor_stripe, _mock_active):
    mock_vendor_stripe.return_value = {"stripe_payouts_enabled": True}
    row = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "pending",
        "stripe_payment_intent_id": "pi_123",
        "event_date": "2099-01-01",
    }
    meta = compute_admin_booking_support_meta(row)
    codes = [f["code"] for f in meta["needs_attention"]]
    assert "payment_not_marked_paid" in codes


@patch("app.features.admin.booking_diagnostics.has_active_dispute_for_booking", return_value=False)
@patch("app.features.admin.booking_diagnostics._get_vendor_stripe_fields")
@patch("app.features.admin.booking_diagnostics._open_dispute_for_booking", return_value=None)
def test_flags_refund_status_mismatch(mock_dispute, mock_vendor_stripe, _mock_active):
    mock_vendor_stripe.return_value = {"stripe_payouts_enabled": True}
    row = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "refunded",
        "event_date": "2099-01-01",
    }
    meta = compute_admin_booking_support_meta(row)
    codes = [f["code"] for f in meta["needs_attention"]]
    assert "refund_status_mismatch" in codes
    assert meta["next_action"] == "Finish cancellation"


@patch("app.features.admin.booking_diagnostics.has_active_dispute_for_booking", return_value=False)
@patch("app.features.admin.booking_diagnostics._get_vendor_stripe_fields")
@patch("app.features.admin.booking_diagnostics._open_dispute_for_booking", return_value=None)
def test_next_action_pay_vendor(mock_dispute, mock_vendor_stripe, _mock_active):
    mock_vendor_stripe.return_value = {"stripe_payouts_enabled": True}
    row = {
        "id": "b1",
        "vendor_user_id": "v1",
        "status": "accepted",
        "payment_status": "paid",
        "client_completion_confirmed_at": "2020-01-02T00:00:00Z",
        "vendor_completion_confirmed_at": "2020-01-02T00:00:00Z",
        "event_date": "2020-01-01",
    }
    meta = compute_admin_booking_support_meta(row)
    assert meta["next_action"] == "Pay vendor"


@patch("app.features.admin.booking_diagnostics.has_active_dispute_for_booking", return_value=False)
@patch("app.features.admin.booking_diagnostics._get_vendor_stripe_fields")
@patch("app.features.admin.booking_diagnostics._open_dispute_for_booking", return_value=None)
def test_next_action_check_payment(mock_dispute, mock_vendor_stripe, _mock_active):
    mock_vendor_stripe.return_value = {"stripe_payouts_enabled": True}
    row = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "pending",
        "stripe_payment_intent_id": "pi_123",
        "event_date": "2099-01-01",
    }
    meta = compute_admin_booking_support_meta(row)
    assert meta["next_action"] == "Check payment"


@patch("app.features.admin.booking_diagnostics.get_settings")
@patch("app.features.admin.booking_diagnostics.get_client")
def test_summarize_support_for_booking_rows(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    mock_get_client.return_value.table.return_value.select.return_value.in_.return_value.execute.side_effect = [
        type("R", (), {"data": [{"user_id": "v1", "stripe_payouts_enabled": True}]})(),
        type("R", (), {"data": []})(),
    ]
    rows = [
        {
            "id": "b1",
            "vendor_user_id": "v1",
            "status": "accepted",
            "payment_status": "paid",
            "client_completion_confirmed_at": "2020-01-02T00:00:00Z",
            "vendor_completion_confirmed_at": "2020-01-02T00:00:00Z",
            "event_date": "2020-01-01",
        },
    ]
    summaries = summarize_support_for_booking_rows(rows)
    assert summaries["b1"]["needs_attention_count"] > 0
    assert summaries["b1"]["next_action"] == "Pay vendor"
