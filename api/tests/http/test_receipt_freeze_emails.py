"""Receipt snapshots and emails at checkout, payout release and admin payment sync."""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.ports import mailer_port
from app.core.settings import Settings, get_settings
from app.features.bookings import repository as bookings_repository
from app.features.bookings import repository_receipts, service_payments_checkout
from app.features.bookings.rows import BookingRow
from app.features.identity import repository as identity_repository
from app.features.payments import domain as payments_domain
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakeMailer, FakePaymentGateway

pytestmark = [pytest.mark.db, pytest.mark.e2e]

WEBHOOK_SECRET = "whsec_test_only_not_a_real_secret"
PACKAGE = {"id": "pkg-1", "title": "Classic Package", "price": "150", "pricingMode": "fixed"}
LINE_ITEM = {"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}


@pytest.fixture
def mailer(app: FastAPI) -> FakeMailer:
    """Capture receipt emails instead of sending them."""
    fake = FakeMailer()
    app.dependency_overrides[mailer_port] = lambda: fake
    return fake


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
    return account_id, issue_access_token(user_id=account_id, email=email, settings=get_settings())


async def _super_admin_headers(session: AsyncSession, email: str) -> dict[str, str]:
    """Bearer headers for a fresh super admin."""
    admin_id = await identity_repository.create_account(
        session,
        email=email,
        user_type="admin",
        admin_role="super_admin",
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert admin_id is not None
    token = issue_access_token(user_id=admin_id, email=email, settings=get_settings())
    return {"Authorization": f"Bearer {token}"}


async def _make_vendor(session: AsyncSession, email: str, *, stripe_ready: bool = False) -> str:
    """An approved listed vendor; optionally Stripe-ready for payouts."""
    vendor_id, _ = await _make_account(session, email, "vendor")
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "api tests: receipt freeze",
            "payload": {
                "businessName": f"Receipt freeze {email}",
                "maxBookingsPerDay": "20",
                "packages": [PACKAGE],
            },
        },
        exists=False,
    )
    assert saved
    if stripe_ready:
        await vendors_repository.update_vendor(
            session,
            vendor_id,
            {
                "stripe_account_id": "acct_test_vendor",
                "stripe_charges_enabled": True,
                "stripe_payouts_enabled": True,
            },
        )
    return vendor_id


async def _make_booking(session: AsyncSession, *, client_id: str, vendor_id: str, **columns: Any) -> str:
    """An accepted booking of the one package, with optional column overrides."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Receipt freeze party",
            "event_date": "2099-06-01",
            "event_address": "1 Test Street, London",
            "status": "accepted",
            "payment_status": "pending",
            "initiator": "client",
            "total_label": "GBP 150",
            "selected_option_ids": ["pkg-1"],
            "line_items": [LINE_ITEM],
            "vendor_adjustments": [],
            **columns,
        },
    )
    return booking.id


async def _receipt_row(session: AsyncSession, booking_id: str):
    """The booking row including frozen receipt snapshot columns."""
    row = await repository_receipts.get_booking_for_receipt(session, booking_id)
    assert row is not None
    return row


async def _booking(session: AsyncSession, booking_id: str) -> BookingRow:
    """The stored booking without the snapshot columns."""
    stored = await bookings_repository.get_booking(session, booking_id)
    assert stored is not None
    return stored


def _completed_session(session_id: str, *, booking_id: str, client_id: str, vendor_id: str) -> dict[str, Any]:
    """A paid Checkout Session as Stripe returns it for the standard GBP 157.50 total."""
    return {
        "id": session_id,
        "payment_status": "paid",
        "amount_total": 15750,
        "payment_intent": {"id": "pi_receipt_freeze", "latest_charge": {"id": "ch_receipt_freeze"}},
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
    """A signed `checkout.session.completed` webhook body and headers."""
    payload = json.dumps(
        {"id": event_id, "type": "checkout.session.completed", "data": {"object": event_object}}
    ).encode()
    timestamp = int(time.time())
    signature = payments_domain.expected_signature(payload, timestamp=timestamp, secret=WEBHOOK_SECRET)
    return payload, {"Stripe-Signature": f"t={timestamp},v1={signature}", "Content-Type": "application/json"}


def _receipt_subjects(mailer: FakeMailer) -> list[str]:
    """The subjects of every email the fake mailer recorded."""
    return [email.subject for email in mailer.sent]


@pytest.fixture
def webhook_secret(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> str:
    """Configure the endpoint's signing secret for this test only."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    return WEBHOOK_SECRET


@pytest.mark.asyncio
async def test_checkout_finalize_freezes_snapshots_and_emails_both_parties(
    client: AsyncClient,
    db_session: AsyncSession,
    payment_gateway: FakePaymentGateway,
    mailer: FakeMailer,
    webhook_secret: str,
) -> None:
    client_id, _ = await _make_account(db_session, "checkout-receipt-client@example.com", "client")
    vendor_id = await _make_vendor(db_session, "checkout-receipt-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        stripe_checkout_session_id="cs_receipt_freeze",
    )
    checkout_session = _completed_session(
        "cs_receipt_freeze", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )
    payment_gateway.objects["ch_receipt_freeze"] = {"id": "ch_receipt_freeze", "receipt_url": None}

    payload, headers = _signed_event("evt_receipt_checkout", checkout_session)
    response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)
    assert response.status_code == 200, response.text

    booking = await _receipt_row(db_session, booking_id)
    assert isinstance(booking.payment_receipt_snapshot, dict)
    assert booking.payment_receipt_snapshot.get("document_type") == "client_payment_receipt"
    assert isinstance(booking.vendor_payment_record_snapshot, dict)
    assert booking.vendor_payment_record_snapshot.get("document_type") == "vendor_payment_record"
    assert _receipt_subjects(mailer) == [
        "Your payment receipt | Eventtz",
        "Payment received | Eventtz",
    ]


@pytest.mark.asyncio
async def test_checkout_webhook_replay_does_not_rewrite_snapshots_or_resend_emails(
    client: AsyncClient,
    db_session: AsyncSession,
    payment_gateway: FakePaymentGateway,
    mailer: FakeMailer,
    webhook_secret: str,
) -> None:
    client_id, _ = await _make_account(db_session, "replay-receipt-client@example.com", "client")
    vendor_id = await _make_vendor(db_session, "replay-receipt-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        stripe_checkout_session_id="cs_receipt_replay",
    )
    checkout_session = _completed_session(
        "cs_receipt_replay", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )
    payment_gateway.objects["ch_receipt_freeze"] = {"id": "ch_receipt_freeze", "receipt_url": None}

    for event_id in ("evt_receipt_replay_1", "evt_receipt_replay_2"):
        payload, headers = _signed_event(event_id, checkout_session)
        response = await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)
        assert response.status_code == 200, response.text

    booking = await _receipt_row(db_session, booking_id)
    first_client = booking.payment_receipt_snapshot
    assert len(mailer.sent) == 2
    mailer.sent.clear()

    payload, headers = _signed_event("evt_receipt_replay_3", checkout_session)
    await client.post("/api/v1/webhooks/stripe", content=payload, headers=headers)
    booking_after = await _receipt_row(db_session, booking_id)
    assert booking_after.payment_receipt_snapshot == first_client
    assert mailer.sent == []


@pytest.mark.asyncio
async def test_payout_release_freezes_statement_and_emails_vendor(
    db_session: AsyncSession, payment_gateway: FakePaymentGateway, mailer: FakeMailer
) -> None:
    from app.features.bookings import service_payments

    client_id, _ = await _make_account(db_session, "payout-receipt-client@example.com", "client")
    vendor_id = await _make_vendor(db_session, "payout-receipt-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="paid",
        payment_amount_gbp=157.5,
        vendor_amount_gbp=150.0,
        platform_fee_gbp=7.5,
        stripe_payment_intent_id="pi_payout_receipt",
        stripe_charge_id="ch_payout_receipt",
        client_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )

    await service_payments.release_vendor_payout(db_session, mailer, payment_gateway, booking_id=booking_id)

    booking = await _receipt_row(db_session, booking_id)
    assert isinstance(booking.vendor_payout_statement_snapshot, dict)
    assert booking.vendor_payout_statement_snapshot.get("document_type") == "vendor_payout_statement"
    assert [email.subject for email in mailer.sent if email.subject.startswith("Payout statement")] == [
        "Payout statement | Eventtz"
    ]


@pytest.mark.asyncio
async def test_admin_sync_from_payment_intent_freezes_checkout_snapshots(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway, mailer: FakeMailer
) -> None:
    admin_headers = await _super_admin_headers(db_session, "receipt-sync-staff@example.com")
    client_id, _ = await _make_account(db_session, "admin-sync-receipt-client@example.com", "client")
    vendor_id = await _make_vendor(db_session, "admin-sync-receipt-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_payment_intent_id="pi_admin_sync_receipt",
    )
    payment_gateway.objects["pi_admin_sync_receipt"] = {
        "id": "pi_admin_sync_receipt",
        "status": "succeeded",
        "amount_received": 15750,
        "metadata": {"booking_id": booking_id, "vendor_amount_gbp": "150.00", "service_fee_gbp": "7.50"},
        "latest_charge": {"id": "ch_admin_sync"},
    }
    payment_gateway.objects["ch_admin_sync"] = {"id": "ch_admin_sync", "receipt_url": None}

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/sync-payment",
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    booking = await _receipt_row(db_session, booking_id)
    assert (await _booking(db_session, booking_id)).payment_status == "paid"
    assert isinstance(booking.payment_receipt_snapshot, dict)
    assert isinstance(booking.vendor_payment_record_snapshot, dict)
    assert len(mailer.sent) == 2


@pytest.mark.asyncio
async def test_receipt_email_failure_does_not_block_checkout_finalize(
    db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    class RaisingMailer:
        """Simulates the provider raising while sending receipt mail."""

        def send(self, email: object) -> bool:
            """Always raise, to prove checkout finalize survives a mailer failure."""
            raise RuntimeError("mailer down")

    client_id, _ = await _make_account(db_session, "mailer-fail-client@example.com", "client")
    vendor_id = await _make_vendor(db_session, "mailer-fail-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        stripe_checkout_session_id="cs_mailer_fail",
    )
    checkout_session = _completed_session(
        "cs_mailer_fail", booking_id=booking_id, client_id=client_id, vendor_id=vendor_id
    )
    payment_gateway.objects["ch_receipt_freeze"] = {"id": "ch_receipt_freeze", "receipt_url": None}

    marked = await service_payments_checkout.finalize_checkout_session(
        db_session, RaisingMailer(), payment_gateway, checkout_session
    )
    assert marked is True
    booking = await _receipt_row(db_session, booking_id)
    assert (await _booking(db_session, booking_id)).payment_status == "paid"
    assert isinstance(booking.payment_receipt_snapshot, dict)
