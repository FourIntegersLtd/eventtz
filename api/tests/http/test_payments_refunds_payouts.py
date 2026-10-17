"""Money leaving Eventtz: a cancel refunds the client, both confirmations pay the vendor by Transfer.

The acceptance suite runs with no Stripe key, so it only reaches the refusals and the
"vendor cannot be paid yet" path. What Stripe is asked to do, with which idempotency
key, and what is stored afterwards is proved here with `FakePaymentGateway`.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.ports import PaymentGatewayError
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.bookings import service_payments
from app.features.bookings.errors import OnlyPaidPayoutRelease
from app.features.bookings.rows import BookingRow
from app.features.disputes import repository as disputes_repository
from app.features.identity import repository as identity_repository
from app.features.notifications import repository as notifications_repository
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakeMailer, FakePaymentGateway, PaymentCall

pytestmark = [pytest.mark.db, pytest.mark.e2e]

LINE_ITEM = {"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}
CANCEL_REFUND_BODY = (
    "This booking was cancelled. Your payment has been refunded in full.\n\n"
    "It should reach your card within 5-10 working days, depending on your bank."
)


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


async def _make_vendor(session: AsyncSession, email: str, *, stripe_ready: bool) -> tuple[str, str]:
    """An approved, listed vendor; with `stripe_ready` Stripe can pay them (account `acct_test_vendor`)."""
    vendor_id, token = await _make_account(session, email, "vendor")
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "api tests: payouts",
            "payload": {"businessName": f"Payout Test {email}", "maxBookingsPerDay": "20"},
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
    return vendor_id, token


async def _make_booking(session: AsyncSession, *, client_id: str, vendor_id: str, **columns: Any) -> str:
    """An accepted, paid booking of a GBP 150 package (client paid GBP 157.50)."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Payout test party",
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


async def _notice_kinds(session: AsyncSession, user_id: str) -> list[tuple[str, str | None]]:
    """The user's notices as (kind, body), newest first."""
    notices = await notifications_repository.latest_for_user(session, user_id, limit=10)
    return [(notice.kind, notice.body) for notice in notices]


async def test_client_cancel_of_a_paid_booking_refunds_in_full_first(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Flexible, event far off: Stripe refunds in full with the cancel key, then the booking is cancelled."""
    client_id, token = await _make_account(db_session, "cancel-refund-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "cancel-refund-vendor@example.com", stripe_ready=True
    )
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date="2099-06-01",
        cancellation_policy="flexible",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["booking_status"] == "cancelled"
    assert payment_gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": None,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-cancel-client",
            },
        )
    ]
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.cancelled_by) == (
        "cancelled",
        "refunded",
        "client",
    )
    assert booking.refunded_at is not None
    assert ("payment_refunded", CANCEL_REFUND_BODY) in await _notice_kinds(db_session, client_id)
    assert (
        "booking_cancelled_by_client",
        "The client has cancelled this booking. Their payment has been refunded in full.\n\n"
        "No further action is needed on your side.",
    ) in await _notice_kinds(db_session, vendor_id)


async def test_a_failed_refund_stops_the_cancel(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Money first: when Stripe refuses the refund the cancel does not happen."""
    client_id, token = await _make_account(db_session, "refund-fails-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "refund-fails-vendor@example.com", stripe_ready=True
    )
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    payment_gateway.error = PaymentGatewayError("Card network down", stripe_code="api_error", http_status=502)

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "We couldn't process the refund right now. Please try again shortly.",
        "code": "refund_failed",
    }
    # The refund was the only thing tried; the 400 rolls the request back, so no cancel is stored
    # (the test's own seed rows go with it, which is why the row is not read back here).
    assert [call.name for call in payment_gateway.calls] == ["create_refund"]


async def test_cancel_mid_checkout_closes_the_checkout_session(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A booking with a checkout open cannot be paid once cancelled: the session is expired."""
    client_id, token = await _make_account(db_session, "cancel-pending-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "cancel-pending-vendor@example.com", stripe_ready=True
    )
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="pending",
        stripe_payment_intent_id=None,
        stripe_charge_id=None,
        stripe_checkout_session_id="cs_test_open",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert payment_gateway.calls == [
        PaymentCall(name="expire_checkout_session", arguments={"session_id": "cs_test_open"})
    ]
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status) == ("cancelled", "pending")


async def test_vendor_cancel_of_a_paid_booking_refunds_with_the_vendor_key(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """The vendor cancelling refunds the client in full and tells them so."""
    client_id, _client_token = await _make_account(db_session, "vendor-cancel-client@example.com", "client")
    vendor_id, token = await _make_vendor(db_session, "vendor-cancel-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    response = await client.patch(
        f"/api/v1/vendor/booking-requests/{booking_id}/status",
        json={"status": "cancelled"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert [call.arguments["idempotency_key"] for call in payment_gateway.calls] == [
        f"refund-{booking_id}-cancel-vendor"
    ]
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.cancelled_by) == (
        "cancelled",
        "refunded",
        "vendor",
    )
    assert (
        "booking_cancelled_by_vendor",
        "The vendor has cancelled this booking. Your payment has been refunded in full.\n\n"
        "It should reach your card within 5-10 working days, depending on your bank.",
    ) in await _notice_kinds(db_session, client_id)


async def test_second_confirmation_pays_the_vendor_by_transfer(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Both confirmed: the vendor's GBP 150 goes by Transfer funded from the client's charge."""
    client_id, _client_token = await _make_account(db_session, "payout-client@example.com", "client")
    vendor_id, token = await _make_vendor(db_session, "payout-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        client_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )

    response = await client.post(
        f"/api/v1/vendor/booking-requests/{booking_id}/confirm-completion",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "success": True,
        "id": booking_id,
        "status": "completed",
        "payment_status": "payout_released",
        "awaiting_other_party": False,
    }
    assert payment_gateway.calls == [
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
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.stripe_transfer_id) == (
        "completed",
        "payout_released",
        "tr_2",
    )
    assert booking.payout_released_at is not None
    assert booking.completed_at is not None
    assert ("booking_completed", None) in await _notice_kinds(db_session, client_id)


async def test_a_transfer_already_made_is_reclaimed_not_repeated(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """If Stripe already holds a Transfer for the booking, that one is recorded and no second is made."""
    client_id, token = await _make_account(db_session, "reclaim-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "reclaim-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )
    payment_gateway.transfers_by_group[f"booking_{booking_id}"] = ["tr_earlier"]

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/confirm-completion",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert [call.name for call in payment_gateway.calls] == ["list_transfer_ids"]
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.stripe_transfer_id) == ("payout_released", "tr_earlier")


async def test_payout_is_held_while_the_vendor_cannot_be_paid(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """No Stripe payouts yet: nothing is sent, the booking stays paid and the vendor is told why."""
    client_id, token = await _make_account(db_session, "held-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "held-vendor@example.com", stripe_ready=False)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/confirm-completion",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["payment_status"] == "paid"
    assert payment_gateway.calls == []
    kinds = [kind for kind, _body in await _notice_kinds(db_session, vendor_id)]
    assert "payout_held_connect_incomplete" in kinds


async def test_a_missing_vendor_amount_refuses_the_payout(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """No vendor share stored: no Transfer, a 400 naming support, and the confirmation is kept."""
    client_id, token = await _make_account(db_session, "noamount-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "noamount-vendor@example.com", stripe_ready=True
    )
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        vendor_amount_gbp=None,
        vendor_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/confirm-completion",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Payout amount is missing for this booking. Please contact support.",
        "code": "payout_amount_missing",
    }
    assert payment_gateway.calls == []
    booking = await _booking(db_session, booking_id)
    assert booking.payment_status == "paid"
    assert booking.client_completion_confirmed_at is not None


async def test_staff_partial_refund_marks_the_booking_partially_refunded(db_session: AsyncSession) -> None:
    """A staff refund of GBP 40 of a paid booking uses the `partial` key and sends the vendor the rest."""
    gateway = FakePaymentGateway()
    client_id, _client_token = await _make_account(db_session, "staff-refund-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "staff-refund-vendor@example.com", stripe_ready=True
    )
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)

    refunded = await service_payments.refund_booking_for_staff(
        db_session, FakeMailer(), gateway, booking_id=booking_id, amount_pence=4000
    )

    assert refunded.payment_status == "partially_refunded"
    assert gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": 4000,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-partial",
            },
        ),
        PaymentCall(name="list_transfer_ids", arguments={"transfer_group": f"booking_{booking_id}"}),
        PaymentCall(
            name="create_transfer",
            arguments={
                "amount_pence": 11000,
                "destination_account_id": "acct_test_vendor",
                "transfer_group": f"booking_{booking_id}",
                "metadata": {"booking_id": booking_id},
                "source_charge_id": "ch_test_paid",
                "idempotency_key": f"transfer-{booking_id}-11000-acct_test_vendor-src-ch_test_paid",
            },
        ),
    ]
    assert (refunded.cancellation_refund_gbp, refunded.cancellation_vendor_share_gbp) == (40.0, 110.0)
    assert refunded.cancellation_payout_at is not None


async def test_staff_payout_release_needs_a_paid_booking(db_session: AsyncSession) -> None:
    """Staff cannot release a payout for a booking whose money was already refunded."""
    client_id, _client_token = await _make_account(db_session, "staff-payout-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "staff-payout-vendor@example.com", stripe_ready=True
    )
    booking_id = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, payment_status="refunded"
    )

    with pytest.raises(OnlyPaidPayoutRelease):
        await service_payments.release_payout_for_staff(
            db_session, FakeMailer(), FakePaymentGateway(), booking_id=booking_id
        )


async def test_resolving_a_dispute_with_a_partial_refund_refunds_that_amount(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A super admin's `partial_refund` of GBP 40 reaches Stripe, and the vendor is sent the other GBP 110."""
    client_id, _client_token = await _make_account(db_session, "dispute-refund-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "dispute-refund-vendor@example.com", stripe_ready=True
    )
    booking_id = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    dispute = await disputes_repository.insert_dispute(
        db_session,
        booking_request_id=booking_id,
        opened_by_user_id=client_id,
        summary="The caterer arrived two hours late.",
        conversation_id=None,
    )
    admin_id = await identity_repository.create_account(
        db_session,
        email="dispute-super-admin@example.com",
        user_type="admin",
        admin_role="super_admin",
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert admin_id is not None
    admin_token = issue_access_token(
        user_id=admin_id, email="dispute-super-admin@example.com", settings=get_settings()
    )

    response = await client.patch(
        f"/api/v1/admin/disputes/{dispute.id}",
        json={"status": "resolved", "resolution_action": "partial_refund", "refund_amount_gbp": 40},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "resolved"
    assert payment_gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": 4000,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-partial",
            },
        ),
        PaymentCall(name="list_transfer_ids", arguments={"transfer_group": f"booking_{booking_id}"}),
        PaymentCall(
            name="create_transfer",
            arguments={
                "amount_pence": 11000,
                "destination_account_id": "acct_test_vendor",
                "transfer_group": f"booking_{booking_id}",
                "metadata": {"booking_id": booking_id},
                "source_charge_id": "ch_test_paid",
                "idempotency_key": f"transfer-{booking_id}-11000-acct_test_vendor-src-ch_test_paid",
            },
        ),
    ]
    booking = await _booking(db_session, booking_id)
    assert (
        booking.payment_status,
        booking.cancellation_refund_percent,
        booking.cancellation_refund_gbp,
        booking.cancellation_vendor_share_gbp,
    ) == ("partially_refunded", None, 40.0, 110.0)
    assert booking.cancellation_payout_at is not None
    assert booking.stripe_transfer_id is not None


def _event_in(days: int) -> str:
    """An event date `days` days from today (UTC), as the booking rows store it."""
    return (datetime.now(UTC) + timedelta(days=days)).date().isoformat()


async def test_client_cancel_under_a_strict_policy_at_45_days_splits_the_money(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Strict, 45 days out: GBP 82.50 (fee + half the vendor price) is refunded, GBP 75 goes to the vendor."""
    client_id, token = await _make_account(db_session, "tiered-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "tiered-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date=_event_in(45),
        paid_at=datetime(2026, 1, 1, tzinfo=UTC),
        cancellation_policy="strict",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "success": True,
        "booking_request_id": booking_id,
        "booking_status": "cancelled",
        "refund_percent": 50,
        "refund_gbp": 82.5,
    }
    assert payment_gateway.calls == [
        PaymentCall(
            name="create_refund",
            arguments={
                "payment_intent_id": "pi_test_paid",
                "amount_pence": 8250,
                "metadata": {"booking_id": booking_id},
                "idempotency_key": f"refund-{booking_id}-cancel-client-8250",
            },
        ),
        PaymentCall(name="list_transfer_ids", arguments={"transfer_group": f"booking_{booking_id}"}),
        PaymentCall(
            name="create_transfer",
            arguments={
                "amount_pence": 7500,
                "destination_account_id": "acct_test_vendor",
                "transfer_group": f"booking_{booking_id}",
                "metadata": {"booking_id": booking_id},
                "source_charge_id": "ch_test_paid",
                "idempotency_key": f"transfer-{booking_id}-7500-acct_test_vendor-src-ch_test_paid",
            },
        ),
    ]
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.cancelled_by) == (
        "cancelled",
        "partially_refunded",
        "client",
    )
    assert (
        booking.cancellation_refund_percent,
        booking.cancellation_refund_gbp,
        booking.cancellation_vendor_share_gbp,
    ) == (50, 82.5, 75.0)
    assert booking.refunded_at is not None
    assert booking.cancellation_payout_at is not None
    assert booking.stripe_transfer_id is not None
    assert (
        "payment_refunded",
        "This booking was cancelled. Under the vendor's Strict cancellation policy, GBP 82.50 of your "
        "GBP 157.50 payment has been refunded (50% of the vendor's price plus the full Eventtz service "
        "fee).\n\nIt should reach your card within 5-10 working days, depending on your bank.",
    ) in await _notice_kinds(db_session, client_id)
    assert (
        "booking_cancelled_by_client",
        "The client has cancelled this booking. Under your Strict cancellation policy they were "
        "refunded 50% of your price plus the Eventtz service fee.\n\n"
        "Your share of GBP 75 has been sent to your connected account.",
    ) in await _notice_kinds(db_session, vendor_id)


async def test_client_cancel_in_cooling_off_refunds_in_full(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Paid an hour ago with the event 10 days out: Strict would give 0%, cooling-off gives all back."""
    client_id, token = await _make_account(db_session, "cooling-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "cooling-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date=_event_in(10),
        paid_at=datetime.now(UTC) - timedelta(hours=1),
        cancellation_policy="strict",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert response.json()["refund_percent"] == 100
    assert [call.name for call in payment_gateway.calls] == ["create_refund"]
    assert payment_gateway.calls[0].arguments["idempotency_key"] == f"refund-{booking_id}-cancel-client"
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.cancellation_refund_percent) == ("refunded", None)


async def test_client_cancel_at_zero_percent_refunds_only_the_fee(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """Strict, 10 days out, paid long ago: GBP 7.50 fee back, the vendor is sent all GBP 150."""
    client_id, token = await _make_account(db_session, "late-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(db_session, "late-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date=_event_in(10),
        paid_at=datetime(2026, 1, 1, tzinfo=UTC),
        cancellation_policy="strict",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert (response.json()["refund_percent"], response.json()["refund_gbp"]) == (0, 7.5)
    assert payment_gateway.calls[0].arguments["amount_pence"] == 750
    assert payment_gateway.calls[2].arguments["amount_pence"] == 15000
    booking = await _booking(db_session, booking_id)
    assert (booking.payment_status, booking.cancellation_vendor_share_gbp) == ("partially_refunded", 150.0)


async def test_the_vendor_share_is_held_until_their_stripe_setup_is_done(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """No payouts yet: the client is still refunded, the share is recorded unsent and the vendor told."""
    client_id, token = await _make_account(db_session, "held-share-client@example.com", "client")
    vendor_id, _vendor_token = await _make_vendor(
        db_session, "held-share-vendor@example.com", stripe_ready=False
    )
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date=_event_in(45),
        paid_at=datetime(2026, 1, 1, tzinfo=UTC),
        cancellation_policy="strict",
    )

    response = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/cancel", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200, response.text
    assert [call.name for call in payment_gateway.calls] == ["create_refund"]
    booking = await _booking(db_session, booking_id)
    assert (booking.status, booking.payment_status, booking.cancellation_vendor_share_gbp) == (
        "cancelled",
        "partially_refunded",
        75.0,
    )
    assert (booking.cancellation_payout_at, booking.stripe_transfer_id) == (None, None)
    vendor_notices = await _notice_kinds(db_session, vendor_id)
    held_body = service_payments._CANCELLATION_SHARE_HELD_BODY
    assert ("payout_held_connect_incomplete", held_body) in vendor_notices
    assert any(
        kind == "booking_cancelled_by_client" and body is not None and "is held until" in body
        for kind, body in vendor_notices
    )


async def test_vendor_payout_history_lists_a_cancellation_share(
    client: AsyncClient, db_session: AsyncSession, payment_gateway: FakePaymentGateway
) -> None:
    """A tiered cancel shows in the vendor's payout history as the share, paid out."""
    client_id, _client_token = await _make_account(db_session, "ledger-client@example.com", "client")
    vendor_id, vendor_token = await _make_vendor(db_session, "ledger-vendor@example.com", stripe_ready=True)
    booking_id = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="cancelled",
        payment_status="partially_refunded",
        cancellation_policy="strict",
        cancellation_refund_percent=50,
        cancellation_refund_gbp=82.5,
        cancellation_vendor_share_gbp=75.0,
        cancellation_payout_at=datetime(2026, 2, 1, tzinfo=UTC),
        stripe_transfer_id="tr_share",
    )

    response = await client.get(
        "/api/v1/vendor/payments/history", headers={"Authorization": f"Bearer {vendor_token}"}
    )

    assert response.status_code == 200, response.text
    payouts = response.json()["payouts"]
    assert [(row["booking_id"], row["amount_gbp"], row["status"], row["kind"]) for row in payouts] == [
        (booking_id, 75.0, "paid_out", "cancellation_share")
    ]
    assert response.json()["total_paid_out_gbp"] == 75.0
