"""Stripe receipt verification uses the payment gateway port (baseline `test_receipt_stripe_verify`)."""

from __future__ import annotations

import pytest

from app.features.bookings.errors import ReceiptStripeVerifyFailed
from app.features.bookings.rows import ReceiptBookingRow
from app.features.bookings.service_receipts import _verify_client_receipt_with_stripe
from tests.support.fakes import FakePaymentGateway


def _booking(**overrides: object) -> ReceiptBookingRow:
    """Minimal paid booking row for Stripe verify tests."""
    base = {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "client_user_id": "11111111-1111-4111-8111-111111111111",
        "vendor_user_id": "22222222-2222-4222-8222-222222222222",
        "status": "accepted",
        "payment_status": "paid",
        "payment_amount_gbp": 525.0,
        "stripe_payment_intent_id": "pi_test",
    }
    base.update(overrides)
    return ReceiptBookingRow.model_validate(base)


@pytest.mark.asyncio
async def test_verify_payment_for_receipt_success() -> None:
    gateway = FakePaymentGateway(
        objects={"pi_test": {"id": "pi_test", "status": "succeeded", "amount_received": 52500}}
    )
    await _verify_client_receipt_with_stripe(gateway, _booking())
    assert gateway.calls[-1].name == "retrieve_payment_intent"


@pytest.mark.asyncio
async def test_verify_payment_for_receipt_amount_mismatch() -> None:
    gateway = FakePaymentGateway(
        objects={"pi_test": {"id": "pi_test", "status": "succeeded", "amount_received": 10000}}
    )
    with pytest.raises(ReceiptStripeVerifyFailed):
        await _verify_client_receipt_with_stripe(gateway, _booking())


@pytest.mark.asyncio
async def test_verify_payment_for_receipt_missing_pi() -> None:
    gateway = FakePaymentGateway()
    with pytest.raises(ReceiptStripeVerifyFailed):
        await _verify_client_receipt_with_stripe(gateway, _booking(stripe_payment_intent_id=None))


@pytest.mark.asyncio
async def test_verify_payment_for_receipt_allows_missing_pi_in_stripe_account() -> None:
    gateway = FakePaymentGateway()
    await _verify_client_receipt_with_stripe(gateway, _booking(stripe_payment_intent_id="pi_old_account"))
