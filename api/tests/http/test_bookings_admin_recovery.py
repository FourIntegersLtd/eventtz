"""Super-admin recovery tools: re-check a payment, pay the vendor, cancel for a party, run maintenance.

The acceptance suite runs with no Stripe key, so it only reaches the refusals and the
unpaid cancel. What Stripe is asked, what is stored and what is audited is proved here
with `FakePaymentGateway`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.bookings.rows import BookingRow
from app.features.disputes import repository as disputes_repository
from app.features.identity import repository as identity_repository
from app.features.notifications import repository as notifications_repository
from app.features.staff.models import AdminAuditLog
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakePaymentGateway, PaymentCall

pytestmark = [pytest.mark.db, pytest.mark.e2e]

LINE_ITEM = {"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}


async def _make_account(
    session: AsyncSession, email: str, user_type: str, admin_role: str | None = None
) -> str:
    """A verified account of the given type; returns its id."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=admin_role,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    return account_id


async def _super_admin_headers(
    session: AsyncSession, email: str = "recovery-super@example.com"
) -> dict[str, str]:
    """Bearer headers for a fresh super admin."""
    admin_id = await _make_account(session, email, "admin", "super_admin")
    token = issue_access_token(user_id=admin_id, email=email, settings=get_settings())
    return {"Authorization": f"Bearer {token}"}


async def _make_parties(session: AsyncSession, prefix: str) -> tuple[str, str]:
    """A client and an approved vendor Stripe can pay (account `acct_test_vendor`): (client id, vendor id)."""
    client_id = await _make_account(session, f"{prefix}-client@example.com", "client")
    vendor_id = await _make_account(session, f"{prefix}-vendor@example.com", "vendor")
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "api tests: recovery",
            "payload": {"businessName": f"Recovery {prefix}", "maxBookingsPerDay": "20"},
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
    return client_id, vendor_id


async def _make_booking(session: AsyncSession, *, client_id: str, vendor_id: str, **columns: Any) -> str:
    """An accepted, paid booking of a GBP 150 package on 1 June 2020 (client paid GBP 157.50)."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Recovery test party",
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


async def _audit_entries(session: AsyncSession, booking_id: str) -> list[tuple[str, dict[str, Any]]]:
    """The admin audit log for the booking as (action, payload)."""
    result = await session.execute(select(AdminAuditLog).where(AdminAuditLog.entity_id == booking_id))
    return [(entry.action, entry.payload) for entry in result.scalars()]


def _transfer_calls(booking_id: str) -> list[PaymentCall]:
    """The Stripe calls a GBP 150 payout to `acct_test_vendor` makes."""
    return [
        PaymentCall(name="list_transfer_ids", arguments={"transfer_group": f"booking_{booking_id}"}),
        PaymentCall(
            name="create_transfer",
            arguments={
                "amount_pence": 15000,
                "destination_account_id": "acct_test_vendor",
                "transfer_group": f"booking_{booking_id}",
                "metadata": {"booking_id": booking_id},
                "source_charge_id": "ch_test_paid",
                "idempotency_key": f"transfer-{booking_id}-15000-acct_test_vendor-src-ch_test_paid",
            },
        ),
    ]


async def test_sync_payment_marks_a_booking_paid_from_its_payment_intent(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The webhook never came: Stripe's succeeded payment intent is stored as the payment."""
    client_id, vendor_id = await _make_parties(db_session, "sync-intent")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        payment_amount_gbp=None,
        vendor_amount_gbp=None,
        stripe_payment_intent_id="pi_test_sync",
        stripe_charge_id=None,
    )
    payment_gateway.objects["pi_test_sync"] = {
        "id": "pi_test_sync",
        "status": "succeeded",
        "amount_received": 15750,
        "latest_charge": "ch_test_sync",
        "metadata": {"booking_id": booking_id, "vendor_amount_gbp": "150.00", "service_fee_gbp": "7.50"},
    }
    payment_gateway.objects["ch_test_sync"] = {
        "id": "ch_test_sync",
        "receipt_url": "https://pay.example/receipt",
    }

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/sync-payment", headers=await _super_admin_headers(db_session)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert (body["booking"]["id"], body["booking"]["payment_status"]) == (booking_id, "paid")
    assert payment_gateway.calls == [
        PaymentCall(name="retrieve_payment_intent", arguments={"payment_intent_id": "pi_test_sync"}),
        PaymentCall(name="retrieve_charge", arguments={"charge_id": "ch_test_sync"}),
    ]
    booking = await _booking(db_session, booking_id)
    assert (
        booking.payment_status,
        booking.stripe_charge_id,
        booking.stripe_receipt_url,
        booking.payment_amount_gbp,
        booking.vendor_amount_gbp,
        booking.platform_fee_gbp,
    ) == ("paid", "ch_test_sync", "https://pay.example/receipt", 157.5, 150.0, 7.5)
    assert booking.paid_at is not None
    assert await _audit_entries(db_session, booking_id) == [("booking.sync_payment", {})]


async def test_sync_payment_resets_a_checkout_stripe_no_longer_has(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A vanished Checkout Session is cleared (so the client can pay again) and staff are told."""
    client_id, vendor_id = await _make_parties(db_session, "sync-gone")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_checkout_session_id="cs_test_gone",
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/sync-payment", headers=await _super_admin_headers(db_session)
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Checkout session not found in Stripe. Checkout was reset - verify charge manually.",
        "code": "recovery_checkout_session_not_found",
    }
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.stripe_checkout_session_id) == ("unpaid", None)


async def test_release_payout_pays_the_vendor_once_the_automatic_date_has_passed(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Nobody confirmed, but the event was in 2020: staff may pay the vendor now."""
    client_id, vendor_id = await _make_parties(db_session, "release")
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/release-payout", headers=await _super_admin_headers(db_session)
    )

    assert response.status_code == 200, response.text
    assert response.json()["booking"]["payment_status"] == "payout_released"
    assert payment_gateway.calls == _transfer_calls(booking_id)
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.stripe_transfer_id) == (
        "completed",
        "payout_released",
        "tr_2",
    )
    assert await _audit_entries(db_session, booking_id) == [("booking.release_payout", {})]


async def test_retry_payout_is_blocked_by_an_open_dispute(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A problem report holds the money: no Transfer is attempted."""
    client_id, vendor_id = await _make_parties(db_session, "retry-dispute")
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    await disputes_repository.insert_dispute(
        db_session,
        booking_request_id=booking_id,
        opened_by_user_id=client_id,
        summary="The DJ never arrived.",
        conversation_id=None,
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/retry-payout", headers=await _super_admin_headers(db_session)
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Open dispute blocks payout release.",
        "code": "recovery_dispute_blocks_payout",
    }
    assert payment_gateway.calls == []


async def test_release_payout_waits_for_the_event_or_both_confirmations(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A future event nobody confirmed is not yet eligible for a payout."""
    client_id, vendor_id = await _make_parties(db_session, "release-early")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date="2099-06-01"
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/release-payout", headers=await _super_admin_headers(db_session)
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Payout can only be released when both parties confirmed or auto-release is due.",
        "code": "recovery_payout_not_eligible",
    }
    assert payment_gateway.calls == []


async def test_cancel_on_behalf_of_the_vendor_refunds_a_paid_booking(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The vendor asked support to cancel: the client is refunded in full with the vendor-cancel key."""
    client_id, vendor_id = await _make_parties(db_session, "on-behalf")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date="2099-06-01"
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/cancel-on-behalf",
        json={"party": "vendor", "reason": "  vendor is ill  "},
        headers=await _super_admin_headers(db_session),
    )

    assert response.status_code == 200, response.text
    assert response.json()["booking"]["status"] == "cancelled"
    assert payment_gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": None,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-cancel-vendor",
            },
        )
    ]
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.cancelled_by) == (
        "cancelled",
        "refunded",
        "vendor",
    )
    assert await _audit_entries(db_session, booking_id) == [
        ("booking.cancel_on_behalf", {"party": "vendor", "reason": "vendor is ill"})
    ]


async def test_complete_cancellation_finishes_a_refunded_booking(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Refunded but still accepted: the booking is cancelled, by the client when nobody was recorded."""
    client_id, vendor_id = await _make_parties(db_session, "complete-cancel")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, payment_status="refunded"
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/complete-cancellation",
        headers=await _super_admin_headers(db_session),
    )

    assert response.status_code == 200, response.text
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.cancelled_by) == (
        "cancelled",
        "refunded",
        "client",
    )
    assert payment_gateway.calls == []


async def test_confirm_completion_for_the_client_pays_the_vendor_who_already_confirmed(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The second confirmation, given by support, releases the payout."""
    client_id, vendor_id = await _make_parties(db_session, "confirm-for")
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/confirm-completion",
        json={"party": "client"},
        headers=await _super_admin_headers(db_session),
    )

    assert response.status_code == 200, response.text
    assert payment_gateway.calls == _transfer_calls(booking_id)
    booking = await _booking(db_session, booking_id)
    assert booking.client_completion_confirmed_at is not None
    assert booking.payment_status == "payout_released"
    assert await _audit_entries(db_session, booking_id) == [
        ("booking.confirm_completion", {"party": "client"})
    ]


async def test_confirm_completion_before_the_event_only_records_it(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Support may confirm early; with the other party still to confirm nothing is paid or sent."""
    client_id, vendor_id = await _make_parties(db_session, "confirm-early")
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date="2099-06-01"
    )

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/confirm-completion",
        json={"party": "vendor"},
        headers=await _super_admin_headers(db_session),
    )

    assert response.status_code == 200, response.text
    assert payment_gateway.calls == []
    booking = await _booking(db_session, booking_id)
    assert booking.vendor_completion_confirmed_at is not None
    assert booking.client_completion_confirmed_at is None
    assert (booking.payment_status, booking.completion_reminder_sent_at) == ("paid", None)


async def test_run_maintenance_reminds_both_parties_and_pays_the_overdue_vendor(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The hourly step, run now: both get the completion reminder, then the overdue payout goes out."""
    client_id, vendor_id = await _make_parties(db_session, "maintenance-now")
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    response = await client.post(
        f"/api/v1/admin/bookings/{booking_id}/run-maintenance", headers=await _super_admin_headers(db_session)
    )

    assert response.status_code == 200, response.text
    assert payment_gateway.calls == _transfer_calls(booking_id)
    booking = await _booking(db_session, booking_id)
    assert booking.payment_status == "payout_released"
    assert booking.completion_reminder_sent_at is not None
    assert booking.payout_auto_released_at is not None
    client_notices = await notifications_repository.latest_for_user(db_session, client_id, limit=10)
    assert (
        "completion_reminder",
        "We hope your event went well.\n\n"
        "If everything was as expected, please confirm the booking is complete. "
        "If something went wrong, report a problem before Thursday 4 June, "
        "otherwise we will pay the vendor automatically.",
    ) in [(notice.kind, notice.body) for notice in client_notices]
    assert await _audit_entries(db_session, booking_id) == [("booking.run_maintenance", {})]


async def test_a_malformed_booking_id_is_refused(client: AsyncClient, db_session: AsyncSession) -> None:
    """Every tool checks the id before it reads anything."""
    response = await client.post(
        "/api/v1/admin/bookings/not-a-uuid/run-maintenance", headers=await _super_admin_headers(db_session)
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid booking id.", "code": "invalid_booking_id"}
