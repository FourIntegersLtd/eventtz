"""Money that must not move: payouts refused by a hold or an open problem report, and the Stripe
webhooks for money that moved outside the app (card chargebacks, dashboard refunds).

Every payout path runs `service_common.check_may_pay_out`; these tests take the paths the
hourly auto-release does not cover. The webhooks are posted signed to the real route, with
`tests.support.fakes.FakePaymentGateway` injected by the `app` fixture.
"""

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
from app.features.bookings import service_maintenance
from app.features.bookings.rows import BookingRow
from app.features.disputes import repository as disputes_repository
from app.features.identity import repository as identity_repository
from app.features.payments import domain
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakeMailer, FakePaymentGateway

pytestmark = [pytest.mark.db]

WEBHOOK_SECRET = "whsec_test_only_not_a_real_secret"
CHARGE_ID = "ch_test_paid"
WEBHOOK_PATH = "/api/v1/webhooks/stripe"


async def _make_account(
    session: AsyncSession, email: str, user_type: str, admin_role: str | None = None
) -> tuple[str, dict[str, str]]:
    """A verified account of the given type: (id, bearer headers)."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=admin_role,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    token = issue_access_token(user_id=account_id, email=email, settings=get_settings())
    return account_id, {"Authorization": f"Bearer {token}"}


async def _make_parties(
    session: AsyncSession, prefix: str
) -> tuple[str, dict[str, str], str, dict[str, str]]:
    """A client and a vendor Stripe can pay: (client id, client headers, vendor id, vendor headers)."""
    client_id, client_headers = await _make_account(session, f"{prefix}-client@example.com", "client")
    vendor_id, vendor_headers = await _make_account(session, f"{prefix}-vendor@example.com", "vendor")
    await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "api tests: holds",
            "payload": {"businessName": f"Hold Test {prefix}", "maxBookingsPerDay": "20"},
        },
        exists=False,
    )
    await vendors_repository.update_vendor(
        session,
        vendor_id,
        {
            "stripe_account_id": "acct_test_vendor",
            "stripe_charges_enabled": True,
            "stripe_payouts_enabled": True,
        },
    )
    return client_id, client_headers, vendor_id, vendor_headers


async def _make_booking(
    session: AsyncSession, *, client_id: str, vendor_id: str, **columns: Any
) -> BookingRow:
    """An accepted, paid GBP 157.50 booking on 1 June 2020 (long over), paid by charge `ch_test_paid`."""
    return await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Held party",
            "event_date": "2020-06-01",
            "status": "accepted",
            "payment_status": "paid",
            "initiator": "client",
            "total_label": "GBP 157.50",
            "selected_option_ids": [],
            "line_items": [],
            "vendor_adjustments": [],
            "payment_amount_gbp": 157.5,
            "vendor_amount_gbp": 150.0,
            "stripe_payment_intent_id": "pi_test_paid",
            "stripe_charge_id": CHARGE_ID,
            **columns,
        },
    )


async def _open_dispute(session: AsyncSession, booking_id: str, client_id: str) -> None:
    """The client reports a problem on the booking (status `open`)."""
    await disputes_repository.insert_dispute(
        session,
        booking_request_id=booking_id,
        opened_by_user_id=client_id,
        summary="The cake never came.",
        conversation_id=None,
    )


async def _stored(session: AsyncSession, booking_id: str) -> BookingRow:
    """The booking as stored now."""
    booking = await bookings_repository.get_booking(session, booking_id)
    assert booking is not None
    return booking


def _signed_event(
    event_id: str, event_type: str, event_object: dict[str, Any]
) -> tuple[bytes, dict[str, str]]:
    """A Stripe delivery of `event_type` and its valid `Stripe-Signature` header."""
    payload = json.dumps({"id": event_id, "type": event_type, "data": {"object": event_object}}).encode()
    timestamp = int(time.time())
    signature = domain.expected_signature(payload, timestamp=timestamp, secret=WEBHOOK_SECRET)
    return payload, {"Stripe-Signature": f"t={timestamp},v1={signature}", "Content-Type": "application/json"}


def _dispute_object(status: str, *, charge_id: str = CHARGE_ID) -> dict[str, Any]:
    """A `charge.dispute.*` event object as Stripe sends it."""
    return {
        "id": "dp_test_1",
        "object": "dispute",
        "charge": charge_id,
        "amount": 15750,
        "currency": "gbp",
        "reason": "product_not_received",
        "status": status,
    }


def _charge_object(amount_refunded: int, *, charge_id: str = CHARGE_ID) -> dict[str, Any]:
    """A `charge.refunded` event object as Stripe sends it."""
    return {
        "id": charge_id,
        "object": "charge",
        "amount": 15750,
        "amount_refunded": amount_refunded,
        "refunded": amount_refunded >= 15750,
    }


@pytest.fixture
def webhook_secret(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> str:
    """Configure the endpoint's signing secret for this test only."""
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    return WEBHOOK_SECRET


@pytest.fixture
def mailer(app: FastAPI) -> FakeMailer:
    """Capture the ops emails instead of sending them."""
    fake = FakeMailer()
    app.dependency_overrides[mailer_port] = lambda: fake
    return fake


def _subjects(mailer: FakeMailer) -> list[str]:
    """The subjects of every email the fake mailer recorded."""
    return [email.subject for email in mailer.sent]


# --- the payout guard --------------------------------------------------------------------------------


async def test_second_confirmation_is_refused_while_a_dispute_is_open(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The vendor confirmed; the client reported a problem; the client confirming must not pay the vendor."""
    client_id, client_headers, vendor_id, _vendor_headers = await _make_parties(db_session, "guard-dispute")
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )
    await _open_dispute(db_session, booking.id, client_id)

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking.id}/confirm-completion", headers=client_headers
    )

    assert response.status_code == 400, response.text
    assert response.json()["code"] == "payout_blocked_by_dispute"
    # A 400 rolls the request back, so the row is as inserted: accepted, paid, client unconfirmed.
    assert payment_gateway.calls == []


async def test_second_confirmation_is_refused_while_support_holds_the_booking(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A support hold (staff, or a chargeback) refuses the confirmation that would pay out."""
    client_id, _client_headers, vendor_id, vendor_headers = await _make_parties(db_session, "guard-hold")
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        client_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
        support_hold=True,
    )

    response = await client.post(
        f"/api/v1/vendor/booking-requests/{booking.id}/confirm-completion", headers=vendor_headers
    )

    assert response.status_code == 400, response.text
    assert response.json()["code"] == "payout_on_support_hold"
    assert payment_gateway.calls == []


async def test_the_stuck_payout_retry_waits_while_support_holds_the_booking(db_session: AsyncSession) -> None:
    """Both confirmed and the Transfer once failed: the hourly retry still does nothing under a hold."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(db_session, "retry-hold")
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        client_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
        support_hold=True,
    )
    gateway = FakePaymentGateway()

    released = await service_maintenance.retry_stuck_payout(db_session, FakeMailer(), gateway, booking)

    assert released is False
    assert gateway.calls == []
    assert (await _stored(db_session, booking.id)).payment_status == "paid"


async def test_staff_confirming_on_behalf_records_it_but_does_not_pay_out_with_a_dispute_open(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Support's confirmation is kept; the money waits for the dispute, as the admin screen says."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(db_session, "staff-dispute")
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )
    await _open_dispute(db_session, booking.id, client_id)
    _admin_id, admin_headers = await _make_account(
        db_session, "staff-dispute-super@example.com", "admin", "super_admin"
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking.id}/confirm-completion",
        json={"party": "client"},
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    assert payment_gateway.calls == []
    stored = await _stored(db_session, booking.id)
    assert stored.payment_status == "paid"
    assert stored.client_completion_confirmed_at is not None


async def test_the_client_detail_says_when_a_dispute_is_open(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The screen hides "Confirm event complete" on this flag."""
    client_id, client_headers, vendor_id, _vendor_headers = await _make_parties(db_session, "detail-flag")
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    before = await client.get(f"/api/v1/client/booking-requests/{booking.id}", headers=client_headers)
    await _open_dispute(db_session, booking.id, client_id)
    after = await client.get(f"/api/v1/client/booking-requests/{booking.id}", headers=client_headers)

    assert before.status_code == 200, before.text
    assert before.json()["booking"]["has_open_dispute"] is False
    assert after.json()["booking"]["has_open_dispute"] is True


# --- card chargebacks --------------------------------------------------------------------------------


async def test_a_chargeback_puts_the_booking_on_hold_and_emails_staff_once(
    client: AsyncClient,
    db_session: AsyncSession,
    payment_gateway: FakePaymentGateway,
    mailer: FakeMailer,
    webhook_secret: str,
) -> None:
    """`charge.dispute.created` sets the support hold; a redelivery changes nothing; no payout follows."""
    client_id, _client_headers, vendor_id, vendor_headers = await _make_parties(db_session, "chargeback-open")
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        client_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )

    for _delivery in range(2):
        payload, headers = _signed_event(
            "evt_dispute_1", "charge.dispute.created", _dispute_object("needs_response")
        )
        response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)
        assert response.status_code == 200, response.text

    stored = await _stored(db_session, booking.id)
    assert stored.support_hold is True
    assert stored.payment_status == "paid"
    assert _subjects(mailer) == [f"[Eventtz ops] Chargeback opened | booking {booking.id[:8]}"]
    email = mailer.sent[0]
    assert email.to == tuple(get_settings().admin_alert_emails_list)
    assert "dp_test_1" in email.text
    assert "GBP 157.50" in email.text

    confirm = await client.post(
        f"/api/v1/vendor/booking-requests/{booking.id}/confirm-completion", headers=vendor_headers
    )
    assert confirm.status_code == 400
    assert confirm.json()["code"] == "payout_on_support_hold"
    assert payment_gateway.calls == []


async def test_a_won_chargeback_lifts_the_hold(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, webhook_secret: str
) -> None:
    """`charge.dispute.closed` with `won`: the booking is paid and payable again."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(db_session, "chargeback-won")
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id, support_hold=True)

    payload, headers = _signed_event("evt_dispute_won", "charge.dispute.closed", _dispute_object("won"))
    response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)

    assert response.status_code == 200, response.text
    stored = await _stored(db_session, booking.id)
    assert (stored.support_hold, stored.payment_status) == (False, "paid")
    assert _subjects(mailer) == [f"[Eventtz ops] Chargeback won | booking {booking.id[:8]}"]


async def test_a_lost_chargeback_marks_the_booking_refunded_and_keeps_the_hold(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, webhook_secret: str
) -> None:
    """Stripe took the money back: `payment_status` is `refunded`; staff settle the rest under the hold."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(
        db_session, "chargeback-lost"
    )
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id, support_hold=True)

    payload, headers = _signed_event("evt_dispute_lost", "charge.dispute.closed", _dispute_object("lost"))
    response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)

    assert response.status_code == 200, response.text
    stored = await _stored(db_session, booking.id)
    assert (stored.support_hold, stored.status, stored.payment_status) == (True, "accepted", "refunded")
    assert stored.refunded_at is not None
    assert _subjects(mailer) == [f"[Eventtz ops] Chargeback lost | booking {booking.id[:8]}"]


async def test_a_chargeback_on_an_unknown_charge_is_acknowledged_and_ignored(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, webhook_secret: str
) -> None:
    """A charge no booking recorded (another system, a test) must not 503 or Stripe retries forever."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(
        db_session, "chargeback-unknown"
    )
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    payload, headers = _signed_event(
        "evt_dispute_unknown",
        "charge.dispute.created",
        _dispute_object("needs_response", charge_id="ch_elsewhere"),
    )
    response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert (await _stored(db_session, booking.id)).support_hold is False
    assert mailer.sent == []


# --- refunds made in the Stripe dashboard --------------------------------------------------------------


async def test_a_dashboard_refund_in_full_marks_the_booking_refunded_and_emails_staff(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, webhook_secret: str
) -> None:
    """`charge.refunded` for the whole charge: the booking can no longer be paid out."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(
        db_session, "ext-refund-full"
    )
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    payload, headers = _signed_event("evt_refund_full", "charge.refunded", _charge_object(15750))
    response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)

    assert response.status_code == 200, response.text
    stored = await _stored(db_session, booking.id)
    assert (stored.status, stored.payment_status) == ("accepted", "refunded")
    assert stored.refunded_at is not None
    assert _subjects(mailer) == [f"[Eventtz ops] Refund outside the app | booking {booking.id[:8]}"]
    assert "GBP 157.50" in mailer.sent[0].text


async def test_a_partial_dashboard_refund_marks_the_booking_partially_refunded(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, webhook_secret: str
) -> None:
    """Part of the charge went back: `partially_refunded`, so every payout and cancel path is closed."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(
        db_session, "ext-refund-part"
    )
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    payload, headers = _signed_event("evt_refund_part", "charge.refunded", _charge_object(5000))
    response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert (await _stored(db_session, booking.id)).payment_status == "partially_refunded"
    assert len(mailer.sent) == 1
    assert "GBP 50.00" in mailer.sent[0].text


async def test_the_echo_of_the_apps_own_refund_changes_nothing(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, webhook_secret: str
) -> None:
    """Stripe sends `charge.refunded` for refunds the app made too; the status already agrees."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(
        db_session, "ext-refund-echo"
    )
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="cancelled",
        payment_status="partially_refunded",
        refunded_at=datetime(2020, 5, 1, tzinfo=UTC),
    )

    payload, headers = _signed_event("evt_refund_echo", "charge.refunded", _charge_object(7875))
    response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)

    assert response.status_code == 200, response.text
    stored = await _stored(db_session, booking.id)
    assert (stored.status, stored.payment_status) == ("cancelled", "partially_refunded")
    assert stored.refunded_at == datetime(2020, 5, 1, tzinfo=UTC).isoformat()
    assert mailer.sent == []


async def test_a_dashboard_refund_after_the_payout_only_alerts_staff(
    client: AsyncClient, db_session: AsyncSession, mailer: FakeMailer, webhook_secret: str
) -> None:
    """The vendor already has the money, so the row is not rewritten: staff recover it in Stripe."""
    client_id, _client_headers, vendor_id, _vendor_headers = await _make_parties(
        db_session, "ext-refund-paid"
    )
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="completed",
        payment_status="payout_released",
    )

    payload, headers = _signed_event("evt_refund_after", "charge.refunded", _charge_object(15750))
    response = await client.post(WEBHOOK_PATH, content=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert (await _stored(db_session, booking.id)).payment_status == "payout_released"
    assert _subjects(mailer) == [f"[Eventtz ops] Refund outside the app | booking {booking.id[:8]}"]
    assert "payout_released" in mailer.sent[0].text
