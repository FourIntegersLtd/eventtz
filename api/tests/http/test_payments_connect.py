"""Vendor payout setup (Stripe Connect) and the Stripe webhook, end to end over HTTP.

The acceptance suite runs the api with no Stripe key, so it can only prove the
refusals. The paths that talk to Stripe are proved here, with
`tests.support.fakes.FakePaymentGateway` injected by the `app` fixture.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.ports import PaymentGatewayError
from app.core.settings import Settings, get_settings
from app.features.identity import repository as identity_repository
from app.features.payments import domain
from app.features.vendors import repository as vendors_repository
from app.features.vendors import service_payouts
from tests.support.fakes import FakePaymentGateway

pytestmark = [pytest.mark.db, pytest.mark.e2e]

WEBHOOK_SECRET = "whsec_test_only_not_a_real_secret"


async def _make_vendor(
    session: AsyncSession, *, email: str, stripe_account_id: str | None = None
) -> tuple[str, str]:
    """A vendor account with a profile row (optionally already linked to Stripe): (id, token)."""
    vendor_id = await identity_repository.create_account(
        session,
        email=email,
        user_type="vendor",
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert vendor_id is not None
    columns: dict[str, object] = {"payload": {"businessName": f"Payout Test {email}"}}
    if stripe_account_id is not None:
        columns["stripe_account_id"] = stripe_account_id
    saved = await vendors_repository.save_profile(session, vendor_id, columns, exists=False)
    assert saved
    return vendor_id, issue_access_token(user_id=vendor_id, email=email, settings=get_settings())


def _signed(payload: bytes, *, secret: str = WEBHOOK_SECRET) -> dict[str, str]:
    """A `Stripe-Signature` header for the payload, signed now with the endpoint secret."""
    timestamp = int(time.time())
    signature = domain.expected_signature(payload, timestamp=timestamp, secret=secret)
    return {"Stripe-Signature": f"t={timestamp},v1={signature}", "Content-Type": "application/json"}


@pytest.fixture
def webhook_secret(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> str:
    """Configure the endpoint's signing secret for this test only."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    return WEBHOOK_SECRET


async def test_connect_account_creates_an_express_account_and_returns_its_onboarding_link(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A vendor with no account gets a new one, stored on their profile, and the link to finish it."""
    vendor_id, token = await _make_vendor(db_session, email="connect-new@example.com")

    response = await client.post(
        "/api/v1/vendor/payments/connect-account",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"success": True, "onboarding_url": "https://connect.example/acct_1"}
    assert [call.name for call in payment_gateway.calls] == ["create_express_account", "create_account_link"]
    assert payment_gateway.calls[0].arguments["email"] == "connect-new@example.com"
    stored = await vendors_repository.get_vendor(db_session, vendor_id)
    assert stored is not None
    assert stored.stripe_account_id == "acct_1"


async def test_connect_account_replaces_an_account_stripe_no_longer_knows(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """An orphaned account with no payout history is forgotten and a fresh one is opened."""
    vendor_id, token = await _make_vendor(
        db_session, email="connect-orphan@example.com", stripe_account_id="acct_gone"
    )
    # Stripe's own wording for an account that belongs to no platform Eventtz can see.
    payment_gateway.error = PaymentGatewayError("No such account: 'acct_gone'", http_status=404)

    response = await client.post(
        "/api/v1/vendor/payments/connect-account",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["onboarding_url"] == "https://connect.example/acct_2"
    assert [call.name for call in payment_gateway.calls] == [
        "retrieve_account",
        "create_express_account",
        "create_account_link",
    ]
    stored = await vendors_repository.get_vendor(db_session, vendor_id)
    assert stored is not None
    assert stored.stripe_account_id == "acct_2"


async def test_status_refreshes_flags_from_stripe_while_onboarding_is_unfinished(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Stored flags are false, Stripe says the account is enabled, so the answer and the row update."""
    vendor_id, token = await _make_vendor(
        db_session, email="connect-status@example.com", stripe_account_id="acct_ready"
    )
    payment_gateway.objects["acct_ready"] = {
        "id": "acct_ready",
        "charges_enabled": True,
        "payouts_enabled": True,
    }

    response = await client.get(
        "/api/v1/vendor/payments/status", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "success": True,
        "stripe_account_id": "acct_ready",
        "charges_enabled": True,
        "payouts_enabled": True,
        "can_accept_bookings": True,
        "payout_gate_waived": False,
    }
    stored = await vendors_repository.get_vendor(db_session, vendor_id)
    assert stored is not None
    assert (stored.stripe_charges_enabled, stored.stripe_payouts_enabled) == (True, True)


async def test_status_does_not_call_stripe_once_onboarding_is_finished(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Both flags already true: the stored state is the answer and Stripe is not asked."""
    vendor_id, token = await _make_vendor(
        db_session, email="connect-done@example.com", stripe_account_id="acct_done"
    )
    await service_payouts.save_stripe_flags(db_session, vendor_id, charges_enabled=True, payouts_enabled=True)

    response = await client.get(
        "/api/v1/vendor/payments/status", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["charges_enabled"] is True
    assert payment_gateway.calls == []


async def test_webhook_without_a_valid_signature_is_rejected(
    client: AsyncClient, webhook_secret: str
) -> None:
    """No header, a wrong secret: both are 400s with stable codes, and nothing is processed."""
    payload = json.dumps({"id": "evt_1", "type": "account.updated"}).encode()

    missing = await client.post("/api/v1/webhooks/stripe", content=payload)
    forged = await client.post(
        "/api/v1/webhooks/stripe", content=payload, headers=_signed(payload, secret="whsec_wrong")
    )

    assert missing.status_code == 400
    assert missing.json() == {
        "detail": "Missing Stripe-Signature header.",
        "code": "missing_stripe_signature",
    }
    assert forged.status_code == 400
    assert forged.json() == {"detail": "Invalid signature.", "code": "invalid_stripe_signature"}


async def test_account_updated_webhook_syncs_the_vendor_once_per_event(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """The event updates the vendor's flags; a redelivery of the same event id does nothing."""
    vendor_id, _token = await _make_vendor(
        db_session, email="connect-webhook@example.com", stripe_account_id="acct_hook"
    )
    payment_gateway.objects["acct_hook"] = {
        "id": "acct_hook",
        "charges_enabled": True,
        "payouts_enabled": False,
    }
    payload = json.dumps(
        {"id": "evt_account_1", "type": "account.updated", "data": {"object": {"id": "acct_hook"}}}
    ).encode()

    first = await client.post("/api/v1/webhooks/stripe", content=payload, headers=_signed(payload))
    again = await client.post("/api/v1/webhooks/stripe", content=payload, headers=_signed(payload))

    assert first.status_code == 200, first.text
    assert first.json() == {"success": True}
    assert again.status_code == 200, again.text
    assert [call.name for call in payment_gateway.calls] == ["retrieve_account"]
    stored = await vendors_repository.get_vendor(db_session, vendor_id)
    assert stored is not None
    assert (stored.stripe_charges_enabled, stored.stripe_payouts_enabled) == (True, False)


async def test_webhook_whose_handler_fails_is_not_claimed_so_stripe_can_redeliver_it(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """Stripe failing mid-handler answers 503; the redelivery then does the work the first try could not."""
    vendor_id, _token = await _make_vendor(
        db_session, email="connect-retry@example.com", stripe_account_id="acct_retry"
    )
    payment_gateway.objects["acct_retry"] = {
        "id": "acct_retry",
        "charges_enabled": True,
        "payouts_enabled": True,
    }
    payload = json.dumps(
        {"id": "evt_account_retry", "type": "account.updated", "data": {"object": {"id": "acct_retry"}}}
    ).encode()
    payment_gateway.error = PaymentGatewayError("Stripe is having a moment", http_status=500)
    # The failed request rolls back; settle the test's own rows first so only the claim is undone.
    await db_session.commit()

    first = await client.post("/api/v1/webhooks/stripe", content=payload, headers=_signed(payload))
    redelivered = await client.post("/api/v1/webhooks/stripe", content=payload, headers=_signed(payload))

    assert first.status_code == 503, first.text
    assert first.json()["code"] == "stripe_webhook_handler_failed"
    assert redelivered.status_code == 200, redelivered.text
    assert [call.name for call in payment_gateway.calls] == ["retrieve_account", "retrieve_account"]
    stored = await vendors_repository.get_vendor(db_session, vendor_id)
    assert stored is not None
    assert (stored.stripe_charges_enabled, stored.stripe_payouts_enabled) == (True, True)


async def test_webhook_of_an_unhandled_type_is_acknowledged_without_calling_stripe(
    client: AsyncClient, payment_gateway: FakePaymentGateway, webhook_secret: str
) -> None:
    """Stripe sends many event types; the ones Eventtz ignores still get a 200 so Stripe stops retrying."""
    payload = json.dumps({"id": "evt_other", "type": "invoice.paid", "data": {"object": {}}}).encode()

    response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=_signed(payload))

    assert response.status_code == 200, response.text
    assert payment_gateway.calls == []
