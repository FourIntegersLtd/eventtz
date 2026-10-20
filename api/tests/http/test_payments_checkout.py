"""The client pays: Checkout, the sync after Stripe's redirect, and the `checkout.session.completed` webhook.

The acceptance suite runs the api with no Stripe key, so it only proves the refusals
before Stripe is reached. The paths past that point are proved here, with
`tests.support.fakes.FakePaymentGateway` injected by the `app` fixture.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.settings import Settings, get_settings
from app.features.bookings import repository as bookings_repository
from app.features.bookings.rows import BookingRow
from app.features.identity import repository as identity_repository
from app.features.payments import domain
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakePaymentGateway

pytestmark = [pytest.mark.db, pytest.mark.e2e]

WEBHOOK_SECRET = "whsec_test_only_not_a_real_secret"
# One GBP 150 package; the default 5% Eventtz fee makes the client total GBP 157.50.
PACKAGE = {"id": "pkg-1", "title": "Classic Package", "price": "150", "pricingMode": "fixed"}
LINE_ITEM = {"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}


async def _make_account(session: AsyncSession, email: str, user_type: str) -> tuple[str, str]:
    """A verified account of the given type: (id, bearer token)."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    # Paying needs the current Terms accepted (terms remediation 0.2).
    await identity_repository.stamp_terms_accepted(session, account_id, get_settings().terms_version)
    return account_id, issue_access_token(user_id=account_id, email=email, settings=get_settings())


async def _make_waived_vendor(session: AsyncSession, email: str) -> str:
    """An approved vendor with one package, listed by a staff override (which waives the payout gate)."""
    vendor_id, _token = await _make_account(session, email, "vendor")
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "api tests: checkout",
            "payload": {
                "businessName": f"Checkout Test {email}",
                "maxBookingsPerDay": "20",
                "packages": [PACKAGE],
            },
        },
        exists=False,
    )
    assert saved
    return vendor_id


async def _make_booking(
    session: AsyncSession,
    *,
    client_id: str,
    vendor_id: str,
    status: str = "accepted",
    payment_status: str = "unpaid",
    **columns: Any,
) -> str:
    """An accepted booking of the one package, with the venue set."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Checkout test party",
            "event_date": "2099-06-01",
            "event_address": "1 Test Street, London",
            "status": status,
            "payment_status": payment_status,
            "initiator": "client",
            "total_label": "GBP 150",
            "selected_option_ids": ["pkg-1"],
            "line_items": [LINE_ITEM],
            "vendor_adjustments": [],
            **columns,
        },
    )
    return booking.id


async def _booking(session: AsyncSession, booking_id: str) -> BookingRow:
    """The stored booking as the request left it."""
    booking = await bookings_repository.get_booking(session, booking_id)
    assert booking is not None
    return booking


def _completed_session(
    session_id: str, *, booking_id: str, client_id: str, vendor_id: str, amount_total: int = 15750
) -> dict[str, Any]:
    """A paid Checkout Session as Stripe returns it, its payment intent expanded with the charge."""
    return {
        "id": session_id,
        "payment_status": "paid",
        "amount_total": amount_total,
        "payment_intent": {"id": "pi_test_1", "latest_charge": {"id": "ch_test_1"}},
        "metadata": {
            "booking_id": booking_id,
            "vendor_user_id": vendor_id,
            "client_user_id": client_id,
            "client_total_gbp": "157.50",
            "vendor_amount_gbp": "150.00",
            "service_fee_gbp": "7.50",
            "referral_fee_discount_gbp": "0.00",
        },
    }


def _signed_event(event_id: str, event_object: dict[str, Any]) -> tuple[bytes, dict[str, str]]:
    """A `checkout.session.completed` delivery and its valid `Stripe-Signature` header."""
    payload = json.dumps(
        {"id": event_id, "type": "checkout.session.completed", "data": {"object": event_object}}
    ).encode()
    timestamp = int(time.time())
    signature = domain.expected_signature(payload, timestamp=timestamp, secret=WEBHOOK_SECRET)
    return payload, {"Stripe-Signature": f"t={timestamp},v1={signature}", "Content-Type": "application/json"}


@pytest.fixture
def webhook_secret(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> str:
    """Configure the endpoint's signing secret for this test only."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    return WEBHOOK_SECRET


async def test_checkout_reprices_from_the_vendor_list_and_opens_a_session(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The session charges the server's total (GBP 150 + the 5% fee), and the booking waits on it."""
    client_id, token = await _make_account(db_session, "checkout-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "checkout-vendor@example.com")
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"success": True, "checkout_url": "https://checkout.example/cs_test_1"}
    assert [call.name for call in payment_gateway.calls] == ["create_checkout_session"]
    frontend_base = get_settings().frontend_url.rstrip("/")
    assert payment_gateway.calls[0].arguments == {
        "amount_pence": 15750,
        "description": "Checkout test party",
        "metadata": {
            "booking_id": booking_id,
            "vendor_user_id": vendor_id,
            "client_user_id": client_id,
            "client_total_gbp": "157.50",
            "vendor_amount_gbp": "150.00",
            "service_fee_gbp": "7.50",
            "referral_fee_discount_gbp": "0.00",
        },
        "customer_email": "checkout-payer@example.com",
        "success_url": (
            f"{frontend_base}/client/bookings/{booking_id}?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
        ),
        "cancel_url": f"{frontend_base}/client/bookings/{booking_id}?payment=cancelled",
    }
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.stripe_checkout_session_id) == ("pending", "cs_test_1")
    assert booking.total_label == "GBP 157.50"


async def test_sync_marks_the_booking_paid_when_stripe_says_paid(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """After the redirect the client's sync records the payment, its ids and Stripe's receipt."""
    client_id, token = await _make_account(db_session, "sync-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "sync-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_open",
    )
    payment_gateway.objects["cs_test_open"] = _completed_session(
        "cs_test_open", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )
    payment_gateway.objects["ch_test_1"] = {
        "id": "ch_test_1",
        "receipt_url": "https://receipts.example/ch_test_1",
    }

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout/sync",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"success": True, "payment_status": "paid"}
    booking = await _booking(db_session, booking_id)
    assert (
        booking.payment_status,
        booking.stripe_payment_intent_id,
        booking.stripe_charge_id,
        booking.stripe_receipt_url,
        booking.payment_amount_gbp,
        booking.vendor_amount_gbp,
        booking.platform_fee_gbp,
    ) == ("paid", "pi_test_1", "ch_test_1", "https://receipts.example/ch_test_1", 157.5, 150.0, 7.5)
    assert booking.paid_at is not None


async def test_sync_of_a_session_stripe_no_longer_knows_clears_it(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """An expired link is dropped from the booking (so "Pay now" starts afresh) and the client is told."""
    client_id, token = await _make_account(db_session, "expired-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "expired-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_gone",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout/sync",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "That payment link has expired. Tap Pay now to start a fresh checkout.",
        "code": "checkout_payment_link_expired",
    }
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.stripe_checkout_session_id) == ("unpaid", None)


async def test_webhook_marks_paid_once_even_when_stripe_redelivers(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """The same event twice, and a second event for the same session, leave one payment and no refund."""
    client_id, _token = await _make_account(db_session, "webhook-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "webhook-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_hook",
    )
    checkout_session = _completed_session(
        "cs_test_hook", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )
    payment_gateway.objects["ch_test_1"] = {"id": "ch_test_1", "receipt_url": None}

    for event_id in ("evt_checkout_1", "evt_checkout_1", "evt_checkout_2"):
        payload, headers = _signed_event(event_id, checkout_session)
        response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)
        assert response.status_code == 200, response.text

    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.payment_amount_gbp, booking.stripe_receipt_url) == (
        "paid",
        157.5,
        None,
    )
    assert [call.name for call in payment_gateway.calls] == ["retrieve_charge", "retrieve_charge"]


async def test_webhook_refuses_a_charge_that_differs_from_the_priced_total(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """A session charging GBP 1 against a GBP 157.50 total is refunded and the booking can be paid again."""
    client_id, _token = await _make_account(db_session, "mismatch-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "mismatch-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_cheap",
    )
    checkout_session = _completed_session(
        "cs_test_cheap", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id, amount_total=100
    )

    payload, headers = _signed_event("evt_checkout_cheap", checkout_session)
    response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert [(call.name, call.arguments["idempotency_key"]) for call in payment_gateway.calls] == [
        ("create_refund", f"refund-{booking_id}-amount-mismatch")
    ]
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.stripe_checkout_session_id) == ("unpaid", None)


async def test_webhook_refunds_a_payment_for_a_booking_that_was_cancelled(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """Money that arrives after the booking left "accepted" goes straight back, once, with a stable key."""
    client_id, _token = await _make_account(db_session, "late-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "late-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="cancelled",
        payment_status="pending",
        stripe_checkout_session_id="cs_test_late",
    )
    checkout_session = _completed_session(
        "cs_test_late", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )

    payload, headers = _signed_event("evt_checkout_late", checkout_session)
    response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert [(call.name, call.arguments) for call in payment_gateway.calls] == [
        (
            "create_refund",
            {
                "payment_intent_id": "pi_test_1",
                "amount_pence": None,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-stale-checkout-not-accepted",
            },
        )
    ]
    assert (await _booking(db_session, booking_id)).payment_status == "refunded"


async def test_webhook_refunds_a_session_a_newer_checkout_replaced(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """Paying an old tab after opening a new checkout refunds the old payment instead of double-charging."""
    client_id, _token = await _make_account(db_session, "stale-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "stale-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_newer",
    )
    checkout_session = _completed_session(
        "cs_test_older", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )

    payload, headers = _signed_event("evt_checkout_stale", checkout_session)
    response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert [call.arguments["idempotency_key"] for call in payment_gateway.calls] == [
        f"refund-{booking_id}-stale-checkout-session"
    ]
    # The newer session is still open, so the booking keeps waiting on it.
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.stripe_checkout_session_id) == ("pending", "cs_test_newer")


async def test_webhook_for_a_stale_session_leaves_a_paid_booking_paid(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """Completing an old tab after the newer session was paid refunds the old payment and nothing else."""
    client_id, _token = await _make_account(db_session, "double-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "double-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="paid",
        stripe_checkout_session_id="cs_test_paid_newer",
        stripe_payment_intent_id="pi_test_paid_newer",
        payment_amount_gbp=157.5,
    )
    checkout_session = _completed_session(
        "cs_test_paid_older", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )

    payload, headers = _signed_event("evt_checkout_double", checkout_session)
    response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert [(call.name, call.arguments["payment_intent_id"]) for call in payment_gateway.calls] == [
        ("create_refund", "pi_test_1")
    ]
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.stripe_checkout_session_id, booking.stripe_payment_intent_id) == (
        "paid",
        "cs_test_paid_newer",
        "pi_test_paid_newer",
    )


async def test_webhook_for_a_completed_booking_refunds_without_reopening_its_payment(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """A stray session completing after the event was paid for and completed never marks it refunded."""
    client_id, _token = await _make_account(db_session, "done-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "done-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="completed",
        payment_status="payout_released",
        stripe_checkout_session_id="cs_test_done",
    )
    checkout_session = _completed_session(
        "cs_test_stray", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )

    payload, headers = _signed_event("evt_checkout_stray", checkout_session)
    response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert [call.name for call in payment_gateway.calls] == ["create_refund"]
    assert (await _booking(db_session, booking_id)).payment_status == "payout_released"


async def test_checkout_closes_the_previous_pending_session_before_opening_a_new_one(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Paying again expires the old link first, so an old tab cannot take a second payment."""
    client_id, token = await _make_account(db_session, "repeat-payer@example.com", "client")
    vendor_id = await _make_waived_vendor(db_session, "repeat-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_previous",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert [(call.name, call.arguments.get("session_id")) for call in payment_gateway.calls] == [
        ("expire_checkout_session", "cs_test_previous"),
        ("create_checkout_session", None),
    ]
    booking = await _booking(db_session, booking_id)
    # The fake names a session after its call count, and the expire call came first.
    assert (booking.payment_status, booking.stripe_checkout_session_id) == ("pending", "cs_test_2")
