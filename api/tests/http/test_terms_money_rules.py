"""The Terms money rules end to end: split payouts, payment deadline, deposits, no-show refunds, refund cap.

Stripe is `FakePaymentGateway`, so every Transfer and Refund is asserted with its exact pence and
idempotency key.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.ports import PaymentGatewayError
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.bookings import service_deposits, service_maintenance, service_payments
from app.features.bookings.errors import PartialRefundTooLarge, PayoutBlockedByDispute, PayoutOnSupportHold
from app.features.bookings.rows import BookingRow
from app.features.disputes import repository as disputes_repository
from app.features.identity import repository as identity_repository
from app.features.notifications import repository as notifications_repository
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakeMailer, FakePaymentGateway, PaymentCall

pytestmark = [pytest.mark.db, pytest.mark.e2e]

LINE_ITEM = {"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}
PACKAGE = {"id": "pkg-1", "title": "Classic Package", "price": "150", "pricingMode": "fixed"}
TRANSFER_SUFFIX = "acct_test_vendor-src-ch_test_paid"


def _today() -> str:
    """Today's date (UTC) as booking rows store it."""
    return datetime.now(UTC).date().isoformat()


async def _make_account(
    session: AsyncSession, email: str, user_type: str, *, admin_role: str | None = None
) -> tuple[str, str]:
    """A verified account that has accepted the current Terms: (id, bearer token)."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=admin_role,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    await identity_repository.stamp_terms_accepted(session, account_id, get_settings().terms_version)
    return account_id, issue_access_token(user_id=account_id, email=email, settings=get_settings())


async def _make_vendor(session: AsyncSession, email: str, **payload: Any) -> tuple[str, str]:
    """A listed vendor Stripe can pay (account `acct_test_vendor`) with the given profile payload."""
    vendor_id, token = await _make_account(session, email, "vendor")
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "api tests: terms money rules",
            "payload": {
                "businessName": f"Terms Test {email}",
                "maxBookingsPerDay": "20",
                "packages": [PACKAGE],
                **payload,
            },
        },
        exists=False,
    )
    assert saved
    await vendors_repository.update_vendor(
        session,
        vendor_id,
        {
            "stripe_account_id": "acct_test_vendor",
            "stripe_charges_enabled": True,
            "stripe_payouts_enabled": True,
        },
    )
    return vendor_id, token


async def _make_booking(session: AsyncSession, *, client_id: str, vendor_id: str, **columns: Any) -> str:
    """An accepted, paid booking of a GBP 150 package (client paid GBP 157.50) on 1 June 2020."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Terms test party",
            "event_date": "2020-06-01",
            "event_address": "1 Test Street, London",
            "status": "accepted",
            "payment_status": "paid",
            "initiator": "client",
            "total_label": "GBP 157.50",
            "selected_option_ids": ["pkg-1"],
            "line_items": [LINE_ITEM],
            "vendor_adjustments": [],
            "payment_amount_gbp": 157.5,
            "vendor_amount_gbp": 150.0,
            "stripe_payment_intent_id": "pi_test_paid",
            "stripe_charge_id": "ch_test_paid",
            **columns,
        },
    )
    return booking.id


async def _booking(session: AsyncSession, booking_id: str) -> BookingRow:
    """The stored booking as the request left it."""
    booking = await bookings_repository.get_booking(session, booking_id)
    assert booking is not None
    return booking


async def _failure_reason(session: AsyncSession, booking_id: str) -> str | None:
    """The booking's `failure_reason` column (the row model does not carry it)."""
    result = await session.execute(
        text("select failure_reason from booking_requests where id = :booking_id"), {"booking_id": booking_id}
    )
    reason: str | None = result.scalar_one()
    return reason


async def _notice_kinds(session: AsyncSession, user_id: str) -> list[str]:
    """The kinds of the user's notices, newest first."""
    notices = await notifications_repository.latest_for_user(session, user_id, limit=10)
    return [notice.kind for notice in notices]


def _transfer(
    booking_id: str, *, amount_pence: int, group_suffix: str = "", part: str | None = None
) -> list[PaymentCall]:
    """The two gateway calls one vendor Transfer makes: look for an earlier one, then create it."""
    group = f"booking_{booking_id}{group_suffix}"
    key_booking = f"{booking_id}-{part}" if part else booking_id
    metadata = {"booking_id": booking_id, **({"payout_part": part} if part else {})}
    return [
        PaymentCall(name="list_transfer_ids", arguments={"transfer_group": group}),
        PaymentCall(
            name="create_transfer",
            arguments={
                "amount_pence": amount_pence,
                "destination_account_id": "acct_test_vendor",
                "transfer_group": group,
                "metadata": metadata,
                "source_charge_id": "ch_test_paid",
                "idempotency_key": f"transfer-{key_booking}-{amount_pence}-{TRANSFER_SUFFIX}",
            },
        ),
    ]


def _split_columns(**columns: Any) -> dict[str, Any]:
    """Columns of a photography booking snapshotted at 70% upfront with 14 days to deliver."""
    return {"payout_upfront_percent": 70, "delivery_deadline_days": 14, **columns}


# --- split payouts ---------------------------------------------------------------------------------------


async def test_split_booking_pays_105_pounds_first_then_the_rest_on_confirmed_delivery(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Both confirm: GBP 105 goes, status completed, still paid. Confirming delivery sends GBP 45."""
    client_id, client_token = await _make_account(db_session, "split-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "split-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
        **_split_columns(),
    )
    headers = {"Authorization": f"Bearer {client_token}"}

    completion = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/confirm-completion", headers=headers
    )

    assert completion.status_code == 200, completion.text
    assert payment_gateway.calls == _transfer(
        booking_id, amount_pence=10500, group_suffix="_upfront", part="upfront"
    )
    after_upfront = await _booking(db_session, booking_id)
    assert (after_upfront.status, after_upfront.payment_status, after_upfront.upfront_amount_gbp) == (
        "completed",
        "paid",
        105.0,
    )
    assert after_upfront.upfront_payout_at is not None
    assert after_upfront.payout_released_at is None
    assert "awaiting_delivery" in await _notice_kinds(db_session, client_id)
    payment_gateway.calls.clear()

    delivery = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/confirm-delivery", headers=headers
    )

    assert delivery.status_code == 200, delivery.text
    assert payment_gateway.calls == _transfer(booking_id, amount_pence=4500)
    final = await _booking(db_session, booking_id)
    assert (final.status, final.payment_status) == ("completed", "payout_released")
    assert final.delivery_confirmed_at is not None
    assert "vendor_final_released" in await _notice_kinds(db_session, vendor_id)


async def test_confirm_delivery_is_refused_when_no_delivery_is_awaited(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A booking whose first part has not been paid has nothing to confirm: 409 delivery_not_awaited."""
    client_id, client_token = await _make_account(db_session, "nodelivery-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "nodelivery-vendor@example.com")
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id, **_split_columns())

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/confirm-delivery",
        headers={"Authorization": f"Bearer {client_token}"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "delivery_not_awaited"
    assert payment_gateway.calls == []


async def test_the_job_pays_the_rest_only_after_the_delivery_deadline(db_session: AsyncSession) -> None:
    """Event 1 June 2020 + 14 days: the job pays the rest. A booking still inside its deadline is skipped."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "deadline-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "deadline-vendor@example.com")
    first_part = {
        "status": "completed",
        "upfront_amount_gbp": 105.0,
        "upfront_payout_at": datetime(2020, 6, 2, tzinfo=UTC),
        "completed_at": datetime(2020, 6, 2, tzinfo=UTC),
    }
    overdue_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, **_split_columns(**first_part)
    )
    recent_day = (datetime.now(UTC) - timedelta(days=3)).date().isoformat()
    waiting_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date=recent_day,
        stripe_charge_id="ch_other",
        **_split_columns(**first_part),
    )

    paid = await service_maintenance.release_final_payouts(db_session, FakeMailer(), gateway)

    assert paid == 1
    assert gateway.calls == _transfer(overdue_id, amount_pence=4500)
    assert (await _booking(db_session, overdue_id)).payment_status == "payout_released"
    assert (await _booking(db_session, waiting_id)).payment_status == "paid"


async def test_staff_release_of_a_split_booking_pays_everything_left_at_once(
    db_session: AsyncSession,
) -> None:
    """Staff releasing a booking whose first part is out sends the remaining GBP 45, not another GBP 105."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "staffsplit-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "staffsplit-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="completed",
        upfront_amount_gbp=105.0,
        upfront_payout_at=datetime(2020, 6, 2, tzinfo=UTC),
        **_split_columns(),
    )

    await service_payments.release_payout_for_staff(db_session, FakeMailer(), gateway, booking_id=booking_id)

    assert gateway.calls == _transfer(booking_id, amount_pence=4500)


# --- payment deadline -------------------------------------------------------------------------------------


async def test_unpaid_bookings_past_their_deadline_are_cancelled_by_the_system(
    db_session: AsyncSession,
) -> None:
    """Accepted 100 hours ago and unpaid: cancelled, both sides told. Accepted 10 hours ago: untouched."""
    client_id, _client_token = await _make_account(db_session, "expire-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "expire-vendor@example.com")
    now = datetime.now(UTC)
    unpaid = {"payment_status": "unpaid", "event_date": "2099-06-01", "stripe_payment_intent_id": None}
    late_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, accepted_at=now - timedelta(hours=100), **unpaid
    )
    fresh_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, accepted_at=now - timedelta(hours=10), **unpaid
    )

    expired = await service_maintenance.expire_unpaid_bookings(db_session, FakeMailer(), FakePaymentGateway())

    assert expired == 1
    late = await _booking(db_session, late_id)
    assert (late.status, late.cancelled_by) == ("cancelled", "system")
    assert await _failure_reason(db_session, late_id) == "PAYMENT_DEADLINE"
    assert "booking_payment_expired" in await _notice_kinds(db_session, client_id)
    assert "vendor_booking_payment_expired" in await _notice_kinds(db_session, vendor_id)
    assert (await _booking(db_session, fresh_id)).status == "accepted"


async def test_a_pending_checkout_is_closed_at_stripe_before_the_booking_expires(
    db_session: AsyncSession,
) -> None:
    """An open Checkout session for an overdue booking is expired first, so it cannot be paid afterwards."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "expirepending-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "expirepending-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_open",
        event_date="2099-06-01",
        accepted_at=datetime.now(UTC) - timedelta(hours=100),
        stripe_payment_intent_id=None,
    )

    expired = await service_maintenance.expire_unpaid_bookings(db_session, FakeMailer(), gateway)

    assert expired == 1
    assert gateway.calls == [
        PaymentCall(name="expire_checkout_session", arguments={"session_id": "cs_test_open"})
    ]
    assert (await _booking(db_session, booking_id)).status == "cancelled"


async def test_checkout_is_refused_after_the_payment_deadline(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Between the deadline and the hourly job the client still cannot pay: 409 payment_deadline_passed."""
    client_id, token = await _make_account(db_session, "late-pay-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "late-pay-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="unpaid",
        event_date="2099-06-01",
        accepted_at=datetime.now(UTC) - timedelta(hours=100),
        stripe_payment_intent_id=None,
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 409
    assert response.json()["code"] == "payment_deadline_passed"
    assert payment_gateway.calls == []


# --- deposits -----------------------------------------------------------------------------------------------


async def test_checkout_charges_the_price_plus_the_refundable_deposit(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """GBP 150 + 5% fee + GBP 50 deposit = 20750p, with the deposit named in metadata and snapshotted."""
    client_id, token = await _make_account(db_session, "deposit-pay-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "deposit-pay-vendor@example.com", servicesOffered=["rentals"], damageDepositGbp="50"
    )
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="unpaid",
        event_date="2099-06-01",
        stripe_payment_intent_id=None,
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    (call,) = payment_gateway.calls
    assert call.arguments["amount_pence"] == 20750
    assert call.arguments["description"] == "Terms test party (includes £50.00 refundable deposit)"
    assert call.arguments["metadata"] == {
        "booking_id": booking_id,
        "vendor_user_id": vendor_id,
        "client_user_id": client_id,
        "client_total_gbp": "207.50",
        "vendor_amount_gbp": "150.00",
        "service_fee_gbp": "7.50",
        "referral_fee_discount_gbp": "0.00",
        "damage_deposit_gbp": "50.00",
    }
    booking = await _booking(db_session, booking_id)
    assert (booking.damage_deposit_gbp, booking.report_window_hours) == (50.0, 96)
    assert (booking.payout_upfront_percent, booking.delivery_deadline_days) == (None, None)


async def test_checkout_without_a_deposit_leaves_the_charge_and_metadata_unchanged(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """An ordinary vendor: 15750p and no `damage_deposit_gbp` key."""
    client_id, token = await _make_account(db_session, "nodeposit-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "nodeposit-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="unpaid",
        event_date="2099-06-01",
        stripe_payment_intent_id=None,
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    (call,) = payment_gateway.calls
    assert call.arguments["amount_pence"] == 15750
    assert "damage_deposit_gbp" not in call.arguments["metadata"]


async def test_checkout_snapshots_a_photographers_split_terms(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Paying copies 55% / 14 days onto the booking, so a later profile edit cannot change them."""
    client_id, token = await _make_account(db_session, "split-pay-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session,
        "split-pay-vendor@example.com",
        servicesOffered=["photography"],
        deliveryUpfrontPercent="55",
        deliveryDeadlineDays="14",
    )
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="unpaid",
        event_date="2099-06-01",
        stripe_payment_intent_id=None,
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    booking = await _booking(db_session, booking_id)
    assert (booking.payout_upfront_percent, booking.delivery_deadline_days) == (55, 14)
    assert payment_gateway.calls[0].arguments["amount_pence"] == 15750


async def test_checkout_splits_a_photographer_who_set_no_split_at_60_percent_and_30_days(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The split is compulsory for photography: a vendor who left it blank is held to the defaults."""
    client_id, token = await _make_account(db_session, "split-default-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "split-default-vendor@example.com", servicesOffered=["photography"]
    )
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="unpaid",
        event_date="2099-06-01",
        stripe_payment_intent_id=None,
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/checkout", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    booking = await _booking(db_session, booking_id)
    assert (booking.payout_upfront_percent, booking.delivery_deadline_days) == (60, 30)


def _paid_deposit_columns(**columns: Any) -> dict[str, Any]:
    """Columns of a paid booking that includes a GBP 50 deposit (client paid GBP 207.50)."""
    return {
        "payment_amount_gbp": 207.5,
        "damage_deposit_gbp": 50.0,
        "paid_at": datetime(2020, 5, 1, tzinfo=UTC),
        **columns,
    }


async def test_an_unclaimed_deposit_is_refunded_once_after_the_claim_window(db_session: AsyncSession) -> None:
    """Event 1 June 2020: the GBP 50 goes back with key refund-<id>-deposit; a second run does nothing."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "autorefund-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "autorefund-vendor@example.com")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, **_paid_deposit_columns()
    )
    inside_window_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date=_today(),
        stripe_payment_intent_id="pi_other",
        **_paid_deposit_columns(),
    )

    first = await service_deposits.refund_due_deposits(db_session, FakeMailer(), gateway)
    second = await service_deposits.refund_due_deposits(db_session, FakeMailer(), gateway)

    assert (first, second) == (1, 0)
    assert gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": 5000,
                "metadata": {"booking_id": booking_id, "refund_part": "deposit"},
                "idempotency_key": f"refund-{booking_id}-deposit",
            },
        )
    ]
    assert (await _booking(db_session, booking_id)).deposit_refunded_at is not None
    assert (await _booking(db_session, inside_window_id)).deposit_refunded_at is None
    assert "deposit_refunded" in await _notice_kinds(db_session, client_id)


async def test_a_deposit_with_a_claim_is_not_refunded_by_the_job(db_session: AsyncSession) -> None:
    """Once the vendor has claimed, only staff decide where the money goes."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "claimed-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "claimed-vendor@example.com")
    await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        **_paid_deposit_columns(deposit_claimed_at=datetime(2020, 6, 2, tzinfo=UTC), deposit_claim_gbp=30.0),
    )

    refunded = await service_deposits.refund_due_deposits(db_session, FakeMailer(), gateway)

    assert refunded == 0
    assert gateway.calls == []


async def test_vendor_claims_part_of_the_deposit_and_staff_split_it(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Claim GBP 30 of GBP 50; staff award GBP 20: Transfer 2000p to the vendor, refund the other 3000p."""
    client_id, _client_token = await _make_account(db_session, "split-dep-client@example.com", "client")
    vendor_id, vendor_token = await _make_vendor(db_session, "split-dep-vendor@example.com")
    _admin_id, admin_token = await _make_account(
        db_session, "split-dep-admin@example.com", "admin", admin_role="super_admin"
    )
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date=_today(), **_paid_deposit_columns()
    )

    claim = await client.post(
        f"/api/v1/vendor/booking-requests/{booking_id}/deposit-claim",
        json={"amount_gbp": 30, "note": "Two chairs were broken during the event."},
        headers={"Authorization": f"Bearer {vendor_token}"},
    )

    assert claim.status_code == 200, claim.text
    assert payment_gateway.calls == []
    claimed = await _booking(db_session, booking_id)
    assert (claimed.deposit_claim_gbp, claimed.deposit_claim_note) == (
        30.0,
        "Two chairs were broken during the event.",
    )
    assert "deposit_claim_opened" in await _notice_kinds(db_session, client_id)

    resolution = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/deposit-claim/resolve",
        json={"award_gbp": 20},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resolution.status_code == 200, resolution.text
    assert payment_gateway.calls == [
        *_transfer(booking_id, amount_pence=2000, group_suffix="_deposit", part="deposit"),
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": 3000,
                "metadata": {"booking_id": booking_id, "refund_part": "deposit-remainder"},
                "idempotency_key": f"refund-{booking_id}-deposit-remainder",
            },
        ),
    ]
    resolved = await _booking(db_session, booking_id)
    assert resolved.deposit_claim_awarded_gbp == 20.0
    assert resolved.deposit_transfer_id is not None
    assert resolved.deposit_claim_resolved_at is not None
    assert resolved.deposit_refunded_at is not None
    assert "vendor_deposit_claim_resolved" in await _notice_kinds(db_session, vendor_id)


async def _claim(
    client: AsyncClient, db_session: AsyncSession, prefix: str, *, event_date: str, amount_gbp: float
) -> tuple[Any, str]:
    """A vendor's claim of `amount_gbp` on a paid GBP 50 deposit booking; returns (response, booking id)."""
    client_id, _client_token = await _make_account(db_session, f"{prefix}-client@example.com", "client")
    vendor_id, vendor_token = await _make_vendor(db_session, f"{prefix}-vendor@example.com")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date=event_date, **_paid_deposit_columns()
    )
    response = await client.post(
        f"/api/v1/vendor/booking-requests/{booking_id}/deposit-claim",
        json={"amount_gbp": amount_gbp, "note": "Everything was damaged badly."},
        headers={"Authorization": f"Bearer {vendor_token}"},
    )
    return response, booking_id


async def test_a_deposit_claim_larger_than_the_deposit_is_refused(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """GBP 60 of a GBP 50 deposit: 4xx deposit_claim_invalid, nothing recorded or moved."""
    response, _booking_id = await _claim(client, db_session, "bigclaim", event_date=_today(), amount_gbp=60)

    assert response.json()["code"] == "deposit_claim_invalid"
    assert payment_gateway.calls == []


async def test_a_deposit_claim_before_the_event_is_refused(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The claim window opens on the event's first day: an event in 2099 gives deposit_claim_closed."""
    response, _booking_id = await _claim(
        client, db_session, "earlyclaim", event_date="2099-06-01", amount_gbp=20
    )

    assert response.status_code == 409
    assert response.json()["code"] == "deposit_claim_closed"
    assert payment_gateway.calls == []


# --- disputes and staff refunds -----------------------------------------------------------------------------


async def _open_dispute(session: AsyncSession, *, booking_id: str, client_id: str) -> str:
    """A dispute on the booking; returns its id."""
    dispute = await disputes_repository.insert_dispute(
        session,
        booking_request_id=booking_id,
        opened_by_user_id=client_id,
        summary="The vendor never arrived.",
        conversation_id=None,
    )
    return dispute.id


async def test_a_vendor_no_show_dispute_refunds_the_client_in_full(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Resolving as vendor_no_show refunds like refund_client: the whole GBP 157.50, key `full`."""
    client_id, _client_token = await _make_account(db_session, "noshow-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "noshow-vendor@example.com")
    _admin_id, admin_token = await _make_account(
        db_session, "noshow-admin@example.com", "admin", admin_role="super_admin"
    )
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    dispute_id = await _open_dispute(db_session, booking_id=booking_id, client_id=client_id)

    response = await client.patch(
        f"/api/v1/admin/disputes/{dispute_id}",
        json={"status": "resolved", "resolution_action": "vendor_no_show"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200, response.text
    assert [call.name for call in payment_gateway.calls] == ["create_refund"]
    assert payment_gateway.calls[0].arguments["idempotency_key"] == f"refund-{booking_id}-full"
    assert payment_gateway.calls[0].arguments["payment_intent_id"] == "pi_test_paid"
    assert (await _booking(db_session, booking_id)).payment_status == "refunded"


async def test_a_staff_partial_refund_over_the_cap_is_refused_with_its_code(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Paid GBP 207.50 including a held GBP 50 deposit: GBP 160 is over the GBP 157.50 cap, nothing moves."""
    client_id, _client_token = await _make_account(db_session, "cap-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "cap-vendor@example.com")
    _admin_id, admin_token = await _make_account(
        db_session, "cap-admin@example.com", "admin", admin_role="super_admin"
    )
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, **_paid_deposit_columns()
    )
    dispute_id = await _open_dispute(db_session, booking_id=booking_id, client_id=client_id)

    response = await client.patch(
        f"/api/v1/admin/disputes/{dispute_id}",
        json={"status": "resolved", "resolution_action": "partial_refund", "refund_amount_gbp": 160},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code in (400, 422)
    assert response.json()["code"] == "partial_refund_too_large"
    assert payment_gateway.calls == []


async def test_partial_refund_cap_excludes_an_upfront_payout_already_sent(db_session: AsyncSession) -> None:
    """GBP 105 already out of GBP 157.50: GBP 52.51 is refused, GBP 52.50 is refunded, no vendor Transfer."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "capup-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "capup-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="completed",
        upfront_amount_gbp=105.0,
        upfront_payout_at=datetime(2020, 6, 2, tzinfo=UTC),
        **_split_columns(),
    )

    with pytest.raises(PartialRefundTooLarge):
        await service_payments.refund_booking_for_staff(
            db_session, FakeMailer(), gateway, booking_id=booking_id, amount_pence=5251
        )
    assert gateway.calls == []

    await service_payments.refund_booking_for_staff(
        db_session, FakeMailer(), gateway, booking_id=booking_id, amount_pence=5250
    )

    assert gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": 5250,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-partial",
            },
        )
    ]


async def test_a_full_refund_after_an_upfront_payout_returns_only_what_is_left(
    db_session: AsyncSession,
) -> None:
    """GBP 157.50 paid, GBP 105 already with the vendor: refund 5250p under the after-upfront key."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "fullup-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "fullup-vendor@example.com")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="completed",
        upfront_amount_gbp=105.0,
        upfront_payout_at=datetime(2020, 6, 2, tzinfo=UTC),
        **_split_columns(),
    )

    await service_payments.refund_booking_for_staff(
        db_session, FakeMailer(), gateway, booking_id=booking_id, amount_pence=None
    )

    assert gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": 5250,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-full-after-upfront-10500",
            },
        )
    ]


# --- recovery of money the row does not know about ---------------------------------------------------


async def _booking_with_unrecorded_upfront(
    session: AsyncSession, gateway: FakePaymentGateway, label: str, **columns: Any
) -> str:
    """A paid split booking whose GBP 105 Transfer exists at Stripe but whose `upfront_payout_at` is NULL."""
    client_id, _client_token = await _make_account(session, f"{label}-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(session, f"{label}-vendor@example.com")
    booking_id = await _make_booking(
        session, client_id=client_id, vendor_id=vendor_id, **_split_columns(**columns)
    )
    gateway.transfers_by_group[f"booking_{booking_id}_upfront"] = ["tr_seeded_upfront"]
    return booking_id


async def test_staff_release_records_an_unrecorded_upfront_and_sends_only_the_remainder(
    db_session: AsyncSession,
) -> None:
    """Upfront Transfer found at Stripe: it is recorded (GBP 105) and only the other 4500p is sent."""
    gateway = FakePaymentGateway()
    booking_id = await _booking_with_unrecorded_upfront(db_session, gateway, "unrecorded-release")

    await service_payments.release_payout_for_staff(db_session, FakeMailer(), gateway, booking_id=booking_id)

    transfers = [call for call in gateway.calls if call.name == "create_transfer"]
    assert [call.arguments["amount_pence"] for call in transfers] == [4500]
    stored = await _booking(db_session, booking_id)
    assert stored.upfront_payout_at is not None
    assert (stored.upfront_amount_gbp, stored.payment_status) == (105.0, "payout_released")


async def test_staff_full_refund_with_an_unrecorded_upfront_returns_paid_minus_upfront(
    db_session: AsyncSession,
) -> None:
    """Same state, full refund: 15750p - 10500p = 5250p, not the whole payment."""
    gateway = FakePaymentGateway()
    booking_id = await _booking_with_unrecorded_upfront(db_session, gateway, "unrecorded-refund")

    await service_payments.refund_booking_for_staff(
        db_session, FakeMailer(), gateway, booking_id=booking_id, amount_pence=None
    )

    refunds = [call for call in gateway.calls if call.name == "create_refund"]
    assert [call.arguments["amount_pence"] for call in refunds] == [5250]
    assert refunds[0].arguments["idempotency_key"] == f"refund-{booking_id}-full-after-upfront-10500"
    assert (await _booking(db_session, booking_id)).upfront_payout_at is not None


# --- deposit claims: remainder refund, holds, paging --------------------------------------------------------


class RefundFailsOnceGateway(FakePaymentGateway):
    """A fake gateway whose first refund fails with a Stripe error; later refunds succeed."""

    async def create_refund(self, **arguments: Any) -> str:
        """Fail the first refund (recorded as a call), then behave like the base fake."""
        if not any(call.name == "create_refund" for call in self.calls):
            self.calls.append(PaymentCall(name="create_refund", arguments=arguments))
            raise PaymentGatewayError("card_declined", stripe_code="card_declined", http_status=402)
        return await super().create_refund(**arguments)


async def _claimed_deposit_booking(session: AsyncSession, label: str, **columns: Any) -> tuple[str, str]:
    """A paid GBP 50 deposit booking with a GBP 30 claim open; returns (booking id, client id)."""
    client_id, _client_token = await _make_account(session, f"{label}-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(session, f"{label}-vendor@example.com")
    booking_id = await _make_booking(
        session,
        client_id=client_id,
        vendor_id=vendor_id,
        **_paid_deposit_columns(
            deposit_claimed_at=datetime(2020, 6, 2, tzinfo=UTC), deposit_claim_gbp=30.0, **columns
        ),
    )
    return booking_id, client_id


async def test_a_claim_awarded_below_the_deposit_refunds_the_remainder_and_stamps_it(
    db_session: AsyncSession,
) -> None:
    """Award GBP 20 of GBP 50: refund 3000p with the deposit-remainder key and stamp deposit_refunded_at."""
    gateway = FakePaymentGateway()
    booking_id, _client_id = await _claimed_deposit_booking(db_session, "remainder")

    resolved = await service_deposits.resolve_deposit_claim(
        db_session, FakeMailer(), gateway, booking_id=booking_id, award_gbp=20.0
    )

    refunds = [call for call in gateway.calls if call.name == "create_refund"]
    assert [call.arguments["amount_pence"] for call in refunds] == [3000]
    assert refunds[0].arguments["idempotency_key"] == f"refund-{booking_id}-deposit-remainder"
    assert (resolved.deposit_claim_awarded_gbp, resolved.deposit_refunded_at is not None) == (20.0, True)


async def test_a_failed_remainder_refund_keeps_the_award_and_the_hourly_job_retries_it(
    db_session: AsyncSession,
) -> None:
    """Refund fails: resolve still succeeds with no stamp; the job later sends the same refund and stamps."""
    gateway = RefundFailsOnceGateway()
    booking_id, _client_id = await _claimed_deposit_booking(db_session, "retry")

    resolved = await service_deposits.resolve_deposit_claim(
        db_session, FakeMailer(), gateway, booking_id=booking_id, award_gbp=20.0
    )

    assert (resolved.deposit_claim_awarded_gbp, resolved.deposit_refunded_at) == (20.0, None)
    assert resolved.deposit_claim_resolved_at is not None

    retried = await service_deposits.refund_due_deposits(db_session, FakeMailer(), gateway)

    assert retried == 1
    refunds = [call for call in gateway.calls if call.name == "create_refund"]
    assert [call.arguments["idempotency_key"] for call in refunds] == [
        f"refund-{booking_id}-deposit-remainder"
    ] * 2
    assert (await _booking(db_session, booking_id)).deposit_refunded_at is not None


async def test_resolving_a_deposit_claim_is_refused_on_a_support_hold(db_session: AsyncSession) -> None:
    """A support hold: payout_on_support_hold, and no Transfer or Refund."""
    gateway = FakePaymentGateway()
    booking_id, _client_id = await _claimed_deposit_booking(db_session, "held", support_hold=True)

    with pytest.raises(PayoutOnSupportHold) as refusal:
        await service_deposits.resolve_deposit_claim(
            db_session, FakeMailer(), gateway, booking_id=booking_id, award_gbp=20.0
        )

    assert refusal.value.code == "payout_on_support_hold"
    assert gateway.calls == []


async def test_resolving_a_deposit_claim_is_refused_during_an_open_dispute(db_session: AsyncSession) -> None:
    """An open problem report: payout_blocked_by_dispute, and no Transfer or Refund."""
    gateway = FakePaymentGateway()
    booking_id, client_id = await _claimed_deposit_booking(db_session, "disputed")
    await _open_dispute(db_session, booking_id=booking_id, client_id=client_id)

    with pytest.raises(PayoutBlockedByDispute) as refusal:
        await service_deposits.resolve_deposit_claim(
            db_session, FakeMailer(), gateway, booking_id=booking_id, award_gbp=20.0
        )

    assert refusal.value.code == "payout_blocked_by_dispute"
    assert gateway.calls == []


async def test_a_full_refund_after_a_deposit_award_settled_returns_paid_minus_the_deposit(
    db_session: AsyncSession,
) -> None:
    """GBP 207.50 paid, the GBP 50 deposit settled by a claim: the full refund is 15750p."""
    gateway = FakePaymentGateway()
    booking_id, _client_id = await _claimed_deposit_booking(
        db_session,
        "fullafterdeposit",
        deposit_claim_resolved_at=datetime(2020, 6, 3, tzinfo=UTC),
        deposit_claim_awarded_gbp=20.0,
        deposit_refunded_at=datetime(2020, 6, 3, tzinfo=UTC),
    )

    await service_payments.refund_booking_for_staff(
        db_session, FakeMailer(), gateway, booking_id=booking_id, amount_pence=None
    )

    refunds = [call for call in gateway.calls if call.name == "create_refund"]
    assert [call.arguments["amount_pence"] for call in refunds] == [15750]
    assert refunds[0].arguments["idempotency_key"] == f"refund-{booking_id}-full-less-5000"


async def test_the_deposit_job_reaches_a_due_booking_behind_a_full_page_of_undue_ones(
    db_session: AsyncSession,
) -> None:
    """55 held deposits with events in 2099 sort first; the due one with the highest id is still refunded."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "paging-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "paging-vendor@example.com")
    for index in range(55):
        await _make_booking(
            db_session,
            client_id=client_id,
            vendor_id=vendor_id,
            id=f"00000000-0000-4000-8000-{index:012d}",
            event_date=f"2099-06-{1 + index % 25:02d}",
            **_paid_deposit_columns(),
        )
    due_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        id="ffffffff-ffff-4fff-8fff-ffffffffffff",
        **_paid_deposit_columns(),
    )

    refunded = await service_deposits.refund_due_deposits(db_session, FakeMailer(), gateway)

    assert refunded == 1
    assert [call.arguments["idempotency_key"] for call in gateway.calls] == [f"refund-{due_id}-deposit"]


async def test_a_dashboard_refund_on_an_unsettled_deposit_booking_is_a_payment_refund(
    db_session: AsyncSession,
) -> None:
    """GBP 50 refunded at Stripe with no deposit stamp is a payment refund: partially_refunded."""
    client_id, _client_token = await _make_account(db_session, "dashboard-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "dashboard-vendor@example.com")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, **_paid_deposit_columns()
    )

    changed = await service_payments.reconcile_external_refund(
        db_session, FakeMailer(), charge_id="ch_test_paid", amount_pence=20750, amount_refunded_pence=5000
    )

    assert changed is True
    assert (await _booking(db_session, booking_id)).payment_status == "partially_refunded"
