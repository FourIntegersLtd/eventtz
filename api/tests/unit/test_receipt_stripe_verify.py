"""Stripe receipt verification uses the payment gateway port (baseline `test_receipt_stripe_verify`)."""

from __future__ import annotations

import pytest

from app.core.errors import Forbidden
from app.core.ports import PaymentGatewayError
from app.features.bookings.errors import (
    ReceiptStripeVerifyFailed,
    ReceiptStripeVerifyPaymentIntentMissing,
)
from app.features.bookings.rows import ReceiptBookingRow
from app.features.bookings.service_receipts import _verify_client_receipt_with_stripe
from tests.support.fakes import FakePaymentGateway

_FROZEN_SNAPSHOT = {
    "document_type": "client_payment_receipt",
    "receipt_number": "EVT-A1B2C3D4",
    "booking_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "event_name": "Summer party",
    "event_date": "2026-09-15",
    "payment_status": "paid",
    "total_label": "GBP 525",
    "counterparty_name": "Vendor",
    "line_items": [],
}


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
async def test_verify_payment_for_receipt_amount_mismatch_unfrozen() -> None:
    gateway = FakePaymentGateway(
        objects={"pi_test": {"id": "pi_test", "status": "succeeded", "amount_received": 10000}}
    )
    with pytest.raises(ReceiptStripeVerifyFailed) as error:
        await _verify_client_receipt_with_stripe(gateway, _booking())
    assert error.value.status == 503
    assert error.value.code == "receipt_stripe_verify_failed"


@pytest.mark.asyncio
async def test_verify_payment_for_receipt_missing_pi_unfrozen() -> None:
    gateway = FakePaymentGateway()
    with pytest.raises(ReceiptStripeVerifyPaymentIntentMissing) as error:
        await _verify_client_receipt_with_stripe(gateway, _booking(stripe_payment_intent_id=None))
    assert error.value.status == 404
    assert error.value.code == "receipt_stripe_verify_failed"


@pytest.mark.asyncio
async def test_verify_payment_for_receipt_allows_missing_pi_in_stripe_account() -> None:
    gateway = FakePaymentGateway()
    await _verify_client_receipt_with_stripe(gateway, _booking(stripe_payment_intent_id="pi_old_account"))
    assert gateway.calls[-1].name == "retrieve_payment_intent"


@pytest.mark.asyncio
async def test_frozen_receipt_skips_verify_on_gateway_500() -> None:
    gateway = FakePaymentGateway(error=PaymentGatewayError("down", http_status=500))
    await _verify_client_receipt_with_stripe(
        gateway, _booking(payment_receipt_snapshot=_FROZEN_SNAPSHOT, stripe_payment_intent_id="pi_test")
    )


@pytest.mark.asyncio
async def test_frozen_receipt_skips_verify_on_gateway_429() -> None:
    gateway = FakePaymentGateway(error=PaymentGatewayError("rate limit", http_status=429))
    await _verify_client_receipt_with_stripe(
        gateway, _booking(payment_receipt_snapshot=_FROZEN_SNAPSHOT, stripe_payment_intent_id="pi_test")
    )


@pytest.mark.asyncio
async def test_frozen_receipt_skips_verify_on_network_error() -> None:
    gateway = FakePaymentGateway(error=PaymentGatewayError("timeout", http_status=0))
    await _verify_client_receipt_with_stripe(
        gateway, _booking(payment_receipt_snapshot=_FROZEN_SNAPSHOT, stripe_payment_intent_id="pi_test")
    )


@pytest.mark.asyncio
async def test_frozen_receipt_skips_verify_when_payments_unavailable() -> None:
    gateway = FakePaymentGateway(configured=False)
    await _verify_client_receipt_with_stripe(
        gateway, _booking(payment_receipt_snapshot=_FROZEN_SNAPSHOT, stripe_payment_intent_id="pi_test")
    )


@pytest.mark.asyncio
async def test_frozen_receipt_skips_verify_on_amount_mismatch() -> None:
    gateway = FakePaymentGateway(
        objects={"pi_test": {"id": "pi_test", "status": "succeeded", "amount_received": 52499}}
    )
    await _verify_client_receipt_with_stripe(
        gateway,
        _booking(
            payment_receipt_snapshot=_FROZEN_SNAPSHOT,
            stripe_payment_intent_id="pi_test",
            payment_amount_gbp=525.0,
        ),
    )


@pytest.mark.asyncio
async def test_unfrozen_verify_gateway_500_raises_unavailable() -> None:
    gateway = FakePaymentGateway(error=PaymentGatewayError("down", http_status=500))
    with pytest.raises(ReceiptStripeVerifyFailed) as error:
        await _verify_client_receipt_with_stripe(gateway, _booking())
    assert error.value.status == 503


@pytest.mark.asyncio
async def test_frozen_missing_pi_still_serves() -> None:
    gateway = FakePaymentGateway()
    await _verify_client_receipt_with_stripe(
        gateway,
        _booking(payment_receipt_snapshot=_FROZEN_SNAPSHOT, stripe_payment_intent_id=None),
    )
    assert gateway.calls == []


@pytest.mark.asyncio
async def test_processing_payment_intent_forbidden_frozen_or_not() -> None:
    gateway = FakePaymentGateway(
        objects={"pi_test": {"id": "pi_test", "status": "processing", "amount_received": 52500}}
    )
    for frozen in (None, _FROZEN_SNAPSHOT):
        with pytest.raises(Forbidden) as error:
            await _verify_client_receipt_with_stripe(
                gateway,
                _booking(payment_receipt_snapshot=frozen),
            )
        assert error.value.message == "Payment is not completed"
