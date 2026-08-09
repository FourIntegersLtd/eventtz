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
