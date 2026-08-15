"""Stripe Connect platform readiness errors."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import stripe

from app.core.errors import ServiceUnavailableError
from app.features.payments import stripe as stripe_module


def test_platform_connect_setup_error_detected() -> None:
    exc = stripe.InvalidRequestError(
        message="Your account must be activated in order to create accounts.",
        param=None,
        code=None,
        http_status=400,
    )
    assert stripe_module._is_platform_connect_setup_error(exc) is True


def test_orphan_account_error_is_not_platform_setup() -> None:
    exc = stripe.InvalidRequestError(
        message="The account acct_123 does not exist.",
        param=None,
        code=None,
        http_status=404,
    )
    assert stripe_module._is_platform_connect_setup_error(exc) is False


def test_platform_connect_profile_questionnaire_error_detected() -> None:
    exc = stripe.InvalidRequestError(
        message=(
            "You must complete your platform profile to use Connect and create live "
            "connected accounts. Visit your dashboard at "
            "https://dashboard.stripe.com/connect/accounts/overview to answer the questionnaire."
        ),
        param=None,
        code=None,
        http_status=400,
    )
    assert stripe_module._is_platform_connect_setup_error(exc) is True


@patch("app.features.payments.stripe._get_vendor_row")
@patch("app.features.payments.stripe._stripe")
def test_create_connect_onboarding_link_maps_platform_profile_incomplete(
    mock_stripe_factory: MagicMock,
    mock_get_vendor_row: MagicMock,
) -> None:
    mock_get_vendor_row.return_value = {"stripe_account_id": None, "payload": {}}
    mock_stripe_factory.return_value.Account.create.side_effect = stripe.InvalidRequestError(
        message=(
            "You must complete your platform profile to use Connect and create live "
            "connected accounts."
        ),
        param=None,
        code=None,
        http_status=400,
    )

    with pytest.raises(ServiceUnavailableError) as raised:
        stripe_module.create_connect_onboarding_link("vendor-1")

    assert raised.value.code == "stripe_connect_unavailable"


@patch("app.features.payments.stripe._get_vendor_row")
@patch("app.features.payments.stripe._stripe")
def test_create_connect_onboarding_link_maps_platform_not_ready(
    mock_stripe_factory: MagicMock,
    mock_get_vendor_row: MagicMock,
) -> None:
    mock_get_vendor_row.return_value = {"stripe_account_id": None, "payload": {}}
    mock_stripe_factory.return_value.Account.create.side_effect = stripe.InvalidRequestError(
        message="Your account must be activated in order to create accounts.",
        param=None,
        code=None,
        http_status=400,
    )

    with pytest.raises(ServiceUnavailableError) as raised:
        stripe_module.create_connect_onboarding_link("vendor-1")

    assert raised.value.code == "stripe_connect_unavailable"
    assert "temporarily unavailable" in raised.value.message.lower()


def _connect_enabled_settings() -> MagicMock:
    settings = MagicMock()
    settings.stripe_secret_key = "sk_test_123"
    return settings


@patch("app.features.payments.stripe.get_settings", new=_connect_enabled_settings)
@patch("app.features.payments.stripe.sync_connect_account_status")
def test_refresh_pending_connect_flags_skips_when_already_enabled(
    mock_sync: MagicMock,
) -> None:
    row = {
        "user_id": "vendor-1",
        "stripe_account_id": "acct_123",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
    }

    assert stripe_module.refresh_pending_connect_flags("vendor-1", row) == row
    mock_sync.assert_not_called()


@patch("app.features.payments.stripe.get_settings", new=_connect_enabled_settings)
@patch("app.features.payments.stripe.sync_connect_account_status")
def test_refresh_pending_connect_flags_skips_without_account(mock_sync: MagicMock) -> None:
    row = {"user_id": "vendor-1", "stripe_account_id": None}

    assert stripe_module.refresh_pending_connect_flags("vendor-1", row) == row
    mock_sync.assert_not_called()


@patch("app.features.payments.stripe.get_settings", new=_connect_enabled_settings)
@patch("app.features.payments.stripe.sync_connect_account_status")
def test_refresh_pending_connect_flags_updates_unverified_row(mock_sync: MagicMock) -> None:
    mock_sync.return_value = {
        "stripe_account_id": "acct_123",
        "charges_enabled": True,
        "payouts_enabled": True,
    }
    row = {
        "user_id": "vendor-1",
        "stripe_account_id": "acct_123",
        "stripe_charges_enabled": False,
        "stripe_payouts_enabled": False,
    }

    refreshed = stripe_module.refresh_pending_connect_flags("vendor-1", row)

    assert refreshed["stripe_charges_enabled"] is True
    assert refreshed["stripe_payouts_enabled"] is True
    assert refreshed["user_id"] == "vendor-1"
    # The caller's row must not be mutated in place.
    assert row["stripe_charges_enabled"] is False


@patch("app.features.payments.stripe.sync_connect_account_status")
def test_refresh_pending_connect_flags_skips_without_stripe_key(mock_sync: MagicMock) -> None:
    settings = MagicMock()
    settings.stripe_secret_key = ""
    row = {"stripe_account_id": "acct_123", "stripe_charges_enabled": False}

    with patch("app.features.payments.stripe.get_settings", return_value=settings):
        assert stripe_module.refresh_pending_connect_flags("vendor-1", row) == row

    mock_sync.assert_not_called()
