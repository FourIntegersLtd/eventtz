"""Tests for Stripe receipt verification on download."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import stripe

from app.features.bookings import messages as booking_messages
from app.features.payments.stripe import ReceiptVerificationError, verify_payment_for_receipt


@patch("app.features.payments.stripe.retrieve_payment_intent")
def test_verify_payment_for_receipt_success(mock_retrieve: MagicMock) -> None:
    mock_retrieve.return_value = {
        "id": "pi_test",
        "status": "succeeded",
        "amount_received": 52500,
    }
    verify_payment_for_receipt(
        payment_intent_id="pi_test",
        expected_amount_gbp=525.0,
    )
    mock_retrieve.assert_called_once_with("pi_test")


@patch("app.features.payments.stripe.retrieve_payment_intent")
def test_verify_payment_for_receipt_amount_mismatch(mock_retrieve: MagicMock) -> None:
    mock_retrieve.return_value = {
        "id": "pi_test",
        "status": "succeeded",
        "amount_received": 10000,
    }
    with pytest.raises(ReceiptVerificationError, match=booking_messages.RECEIPT_STRIPE_VERIFY_FAILED):
        verify_payment_for_receipt(
            payment_intent_id="pi_test",
            expected_amount_gbp=525.0,
        )


def test_verify_payment_for_receipt_missing_pi() -> None:
    with pytest.raises(ReceiptVerificationError):
        verify_payment_for_receipt(payment_intent_id=None, expected_amount_gbp=10.0)


@patch("app.features.payments.stripe.retrieve_payment_intent")
def test_verify_payment_for_receipt_allows_missing_pi_in_stripe_account(mock_retrieve: MagicMock) -> None:
    err = stripe.InvalidRequestError(
        message="No such payment_intent",
        param="intent",
        code="resource_missing",
        http_status=404,
    )
    mock_retrieve.side_effect = err
    verify_payment_for_receipt(
        payment_intent_id="pi_old_account",
        expected_amount_gbp=525.0,
    )
