"""The hourly booking maintenance, step by step: completion reminders, automatic payouts, stale
enquiries and vendor enquiry reminders.

The job opens its own transactions, which a test transaction cannot see, so these
call the per-booking steps it runs with the test's session and fakes.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository as bookings_repository
from app.features.bookings import repository_maintenance, service_maintenance
from app.features.bookings.rows import BookingRow
from app.features.disputes import repository as disputes_repository
from app.features.identity import repository as identity_repository
from app.features.notifications import repository as notifications_repository
from app.features.vendors import repository as vendors_repository
from tests.support.fakes import FakeMailer, FakePaymentGateway

pytestmark = [pytest.mark.db]

VENDOR_REMINDER_BODY = (
    "Your event date has passed.\n\n"
    "Please confirm the booking is complete to receive your payout sooner. "
    "If the client does not respond, you will be paid automatically on Thursday 4 June "
    "unless they have reported a problem."
)


async def _make_parties(session: AsyncSession, prefix: str) -> tuple[str, str]:
    """A client and a vendor Stripe can pay: (client id, vendor id)."""
    account_ids = []
    for user_type in ("client", "vendor"):
        account_id = await identity_repository.create_account(
            session,
            email=f"{prefix}-{user_type}@example.com",
            user_type=user_type,
            admin_role=None,
            email_verified_at=datetime.now(UTC),
            account_suspended=False,
        )
        assert account_id is not None
        account_ids.append(account_id)
    client_id, vendor_id = account_ids
    await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "payload": {"businessName": f"Maint {prefix}", "maxBookingsPerDay": "20"},
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
    return client_id, vendor_id


async def _make_booking(
    session: AsyncSession, *, client_id: str, vendor_id: str, **columns: Any
) -> BookingRow:
    """An accepted, paid GBP 150 booking on 1 June 2020, so its automatic payout date (4 June) has passed."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Maintenance party",
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
            "stripe_charge_id": "ch_test_paid",
            **columns,
        },
    )
    return booking


async def _stored(session: AsyncSession, booking_id: str) -> BookingRow:
    """The booking as stored now."""
    booking = await bookings_repository.get_booking(session, booking_id)
    assert booking is not None
    return booking


async def _notices(session: AsyncSession, user_id: str) -> list[tuple[str, str | None]]:
    """The user's notices as (kind, body), newest first."""
    notices = await notifications_repository.latest_for_user(session, user_id, limit=10)
    return [(notice.kind, notice.body) for notice in notices]


async def test_completion_reminder_goes_to_whoever_has_not_confirmed_once(db_session: AsyncSession) -> None:
    """The client confirmed already, so only the vendor is reminded, and a second run sends nothing."""
    client_id, vendor_id = await _make_parties(db_session, "remind-once")
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        client_completion_confirmed_at=datetime(2020, 6, 2, tzinfo=UTC),
    )
    mailer = FakeMailer()

    first = await service_maintenance.remind_completion(db_session, mailer, booking.id)
    second = await service_maintenance.remind_completion(db_session, mailer, booking.id)

    assert (first, second) == (True, False)
    assert await _notices(db_session, vendor_id) == [("vendor_completion_reminder", VENDOR_REMINDER_BODY)]
    assert await _notices(db_session, client_id) == []


async def test_future_events_get_no_reminder(db_session: AsyncSession) -> None:
    """Before the event is over nobody is asked to confirm it."""
    client_id, vendor_id = await _make_parties(db_session, "remind-future")
    booking = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date="2099-06-01"
    )

    sent = await service_maintenance.remind_completion(db_session, FakeMailer(), booking.id)

    assert sent is False
    assert (await _stored(db_session, booking.id)).completion_reminder_sent_at is None


async def test_due_bookings_are_the_paid_ones_whose_event_is_over(db_session: AsyncSession) -> None:
    """The hourly job picks the 2020 booking and leaves the 2099 one for later."""
    client_id, vendor_id = await _make_parties(db_session, "due-list")
    past = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    future = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date="2099-06-01"
    )

    due = await service_maintenance.due_post_event_booking_ids(
        db_session, unset_column="payout_auto_released_at"
    )

    assert past.id in due
    assert future.id not in due


async def test_auto_release_pays_the_vendor_and_stamps_the_booking(db_session: AsyncSession) -> None:
    """Past the automatic payout date: a Transfer is made and the booking is marked auto-released."""
    client_id, vendor_id = await _make_parties(db_session, "auto-release")
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    gateway = FakePaymentGateway()

    released = await service_maintenance.auto_release_booking(db_session, FakeMailer(), gateway, booking.id)

    assert released is True
    assert [call.name for call in gateway.calls] == ["list_transfer_ids", "create_transfer"]
    stored = await _stored(db_session, booking.id)
    assert (stored.status, stored.payment_status) == ("completed", "payout_released")
    assert stored.payout_auto_released_at is not None


async def test_a_support_hold_stops_the_automatic_payout(db_session: AsyncSession) -> None:
    """Staff paused the payout: nothing is sent to Stripe."""
    client_id, vendor_id = await _make_parties(db_session, "auto-hold")
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id, support_hold=True)
    gateway = FakePaymentGateway()

    released = await service_maintenance.auto_release_booking(db_session, FakeMailer(), gateway, booking.id)

    assert released is False
    assert gateway.calls == []


async def test_an_open_dispute_stops_the_automatic_payout(db_session: AsyncSession) -> None:
    """The client reported a problem: the money stays held."""
    client_id, vendor_id = await _make_parties(db_session, "auto-dispute")
    booking = await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id)
    await disputes_repository.insert_dispute(
        db_session,
        booking_request_id=booking.id,
        opened_by_user_id=client_id,
        summary="The cake never came.",
        conversation_id=None,
    )
    gateway = FakePaymentGateway()

    released = await service_maintenance.auto_release_booking(db_session, FakeMailer(), gateway, booking.id)

    assert released is False
    assert gateway.calls == []
    assert (await _stored(db_session, booking.id)).payout_auto_released_at is None


async def test_a_refused_transfer_is_left_for_the_next_run(db_session: AsyncSession) -> None:
    """No vendor share stored: the payout is refused, nothing is stamped, and the step reports False."""
    client_id, vendor_id = await _make_parties(db_session, "auto-refused")
    booking = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, vendor_amount_gbp=None
    )
    gateway = FakePaymentGateway()

    released = await service_maintenance.auto_release_booking(db_session, FakeMailer(), gateway, booking.id)

    assert released is False
    assert gateway.calls == []
    stored = await _stored(db_session, booking.id)
    assert (stored.payment_status, stored.payout_auto_released_at) == ("paid", None)


async def test_stale_enquiries_are_marked_once(db_session: AsyncSession) -> None:
    """An enquiry four days unanswered is past the 72-hour SLA; one sent an hour ago is not."""
    client_id, vendor_id = await _make_parties(db_session, "stale")
    now = datetime.now(UTC)
    for created_at in (now - timedelta(days=4), now - timedelta(hours=1)):
        await _make_booking(
            db_session,
            client_id=client_id,
            vendor_id=vendor_id,
            status="pending",
            payment_status="unpaid",
            event_date="2099-06-01",
            created_at=created_at,
        )

    first = await service_maintenance.mark_stale_enquiries(db_session)
    second = await service_maintenance.mark_stale_enquiries(db_session)

    assert (first, second) == (1, 0)


async def test_vendor_enquiry_reminders_follow_the_1_6_24_hour_steps(db_session: AsyncSession) -> None:
    """Seven hours unanswered: the 1-hour and 6-hour nudges go out, each only once."""
    client_id, vendor_id = await _make_parties(db_session, "enquiry-nudge")
    enquiry = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="pending",
        payment_status="unpaid",
        event_date="2099-06-01",
        created_at=datetime.now(UTC) - timedelta(hours=7),
    )
    mailer = FakeMailer()

    first = await service_maintenance.send_enquiry_reminders(db_session, mailer)
    second = await service_maintenance.send_enquiry_reminders(db_session, mailer)

    assert (first, second) == (2, 0)
    kinds = sorted(kind for kind, _body in await _notices(db_session, vendor_id))
    assert kinds == ["enquiry_reminder_1h", "enquiry_reminder_6h"]
    unanswered = await repository_maintenance.unanswered_enquiries(db_session, limit=200)
    stamps = [
        (
            bool(row.enquiry_reminder_1h_at),
            bool(row.enquiry_reminder_6h_at),
            bool(row.enquiry_reminder_24h_at),
        )
        for row in unanswered
        if row.id == enquiry.id
    ]
    assert stamps == [(True, True, False)]
