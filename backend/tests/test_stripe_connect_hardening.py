"""Tests for Stripe Connect sync hardening (no wrongful clears)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import stripe

from app.features.payments import stripe as stripe_module


def test_permission_error_is_not_orphan() -> None:
    exc = stripe.PermissionError("No access")
    assert stripe_module._is_orphan_connect_account_error(exc) is False


def test_invalid_request_not_found_is_orphan() -> None:
    exc = stripe.InvalidRequestError(
        message="No such account: acct_123",
        param=None,
        code=None,
        http_status=404,
    )
    assert stripe_module._is_orphan_connect_account_error(exc) is True


@patch("app.features.admin.audit.insert_admin_audit_log")
@patch("app.features.payments.stripe.get_db")
@patch("app.features.payments.stripe.vendor_has_payout_history", return_value=True)
@patch("app.features.payments.stripe._get_vendor_row")
def test_clear_blocked_when_payout_history(
    mock_row: MagicMock,
    _mock_history: MagicMock,
    mock_client: MagicMock,
    _mock_audit: MagicMock,
) -> None:
    mock_row.return_value = {
        "stripe_account_id": "acct_paid",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
    }
    cleared = stripe_module._clear_vendor_stripe_connect(
        "vendor-1",
        trigger="test",
        stripe_error="orphan",
    )
    assert cleared is False
    mock_client.return_value.table.return_value.update.assert_not_called()


@patch("app.features.payments.stripe._clear_vendor_stripe_connect")
@patch("app.features.payments.stripe._stripe")
@patch("app.features.payments.stripe._get_vendor_row")
def test_sync_permission_error_soft_fails(
    mock_row: MagicMock,
    mock_stripe_factory: MagicMock,
    mock_clear: MagicMock,
) -> None:
    mock_row.return_value = {
        "stripe_account_id": "acct_123",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
    }
    mock_stripe_factory.return_value.Account.retrieve.side_effect = stripe.PermissionError(
        "No access",
    )
    out = stripe_module.sync_connect_account_status("vendor-1")
    assert out["stripe_account_id"] == "acct_123"
    assert out["charges_enabled"] is True
    assert out["payouts_enabled"] is True
    mock_clear.assert_not_called()


@patch("app.features.payments.stripe.sync_connect_account_status")
@patch("app.features.payments.stripe.get_settings")
@patch("app.features.payments.stripe._get_vendor_row")
def test_status_response_skips_sync_when_fully_enabled(
    mock_row: MagicMock,
    mock_settings: MagicMock,
    mock_sync: MagicMock,
) -> None:
    settings = MagicMock()
    settings.stripe_secret_key = "sk_test_123"
    mock_settings.return_value = settings
    mock_row.return_value = {
        "stripe_account_id": "acct_123",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
    }
    out = stripe_module.get_vendor_connect_status_response("vendor-1")
    assert out["stripe_account_id"] == "acct_123"
    mock_sync.assert_not_called()


@patch("app.features.payments.stripe._stripe")
@patch("app.features.payments.stripe.get_settings")
@patch("app.features.payments.stripe.get_db")
def test_restore_from_payout_transfer(
    mock_client: MagicMock,
    mock_settings: MagicMock,
    mock_stripe_factory: MagicMock,
) -> None:
    settings = MagicMock()
    settings.stripe_secret_key = "sk_test_123"
    mock_settings.return_value = settings

    mock_table = MagicMock()
    mock_client.return_value.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.not_.is_.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[{"stripe_transfer_id": "tr_abc"}],
    )
    mock_table.update.return_value = mock_table

    stripe_api = mock_stripe_factory.return_value
    stripe_api.Transfer.retrieve.return_value = {"destination": "acct_restored"}
    stripe_api.Account.retrieve.return_value = {
        "charges_enabled": True,
        "payouts_enabled": True,
    }

    out = stripe_module.restore_vendor_connect_from_payout_history("vendor-1")
    assert out["stripe_account_id"] == "acct_restored"
    assert out["restored_from_transfer_id"] == "tr_abc"
    update_payload = mock_table.update.call_args[0][0]
    assert update_payload["stripe_account_id"] == "acct_restored"
