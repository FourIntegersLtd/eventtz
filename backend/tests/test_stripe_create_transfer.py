"""Vendor payout Transfer create: reclaim + param-bound idempotency."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import stripe

from app.features.payments import stripe as stripe_service


@patch("app.features.payments.stripe._stripe")
def test_create_transfer_reclaims_existing(mock_stripe):
    mock_stripe.return_value.Transfer.list.return_value = SimpleNamespace(
        data=[SimpleNamespace(id="tr_existing")],
    )

    tid = stripe_service.create_transfer(
        destination_account_id="acct_1",
        amount_gbp=100.0,
        booking_id="booking-1",
    )

    assert tid == "tr_existing"
    mock_stripe.return_value.Transfer.create.assert_not_called()


@patch("app.features.payments.stripe._stripe")
def test_create_transfer_uses_param_bound_idempotency_key(mock_stripe):
    mock_stripe.return_value.Transfer.list.return_value = SimpleNamespace(data=[])
    mock_stripe.return_value.Transfer.create.return_value = {"id": "tr_new"}

    tid = stripe_service.create_transfer(
        destination_account_id="acct_abc",
        amount_gbp=12.34,
        booking_id="booking-2",
    )

    assert tid == "tr_new"
    kwargs = mock_stripe.return_value.Transfer.create.call_args.kwargs
    assert kwargs["amount"] == 1234
    assert kwargs["destination"] == "acct_abc"
    assert kwargs["idempotency_key"] == "transfer-booking-2-1234-acct_abc"
    assert kwargs["transfer_group"] == "booking_booking-2"


@patch("app.features.payments.stripe._stripe")
def test_create_transfer_reclaims_after_idempotency_error(mock_stripe):
    mock_stripe.return_value.Transfer.list.side_effect = [
        SimpleNamespace(data=[]),
        SimpleNamespace(data=[SimpleNamespace(id="tr_race")]),
    ]
    mock_stripe.return_value.Transfer.create.side_effect = stripe.IdempotencyError(
        message="params mismatch",
        http_status=400,
        json_body={},
    )

    tid = stripe_service.create_transfer(
        destination_account_id="acct_1",
        amount_gbp=50.0,
        booking_id="booking-3",
    )

    assert tid == "tr_race"


@patch("app.features.payments.stripe._stripe")
def test_create_transfer_rejects_zero_amount(mock_stripe):
    mock_stripe.return_value.Transfer.list.return_value = SimpleNamespace(data=[])
    try:
        stripe_service.create_transfer(
            destination_account_id="acct_1",
            amount_gbp=0,
            booking_id="booking-4",
        )
        raise AssertionError("expected ValueError")
    except ValueError as e:
        assert "£0.01" in str(e)
    mock_stripe.return_value.Transfer.create.assert_not_called()
