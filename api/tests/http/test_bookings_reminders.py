"""The four extra hourly reminders: client no-response nudge, pay to confirm, event tomorrow, payouts setup.

Each is tested as due (one email, marker set), run twice (no second email) and not due.
Like the other maintenance tests these call the steps with the test's session and fakes,
because the job opens transactions of its own that a test transaction cannot see.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import jobs, service_reminders
from app.features.vendors import repository as vendors_repository
from tests.http.test_bookings_maintenance import _make_booking, _make_parties, _notices, _stored
from tests.support.fakes import FakeLanguageModel, FakeMailer, FakePaymentGateway

pytestmark = [pytest.mark.db]

NOW = datetime(2030, 6, 10, 12, 0, tzinfo=UTC)


def _sent_to(mailer: FakeMailer, address: str) -> list[str]:
    """The subjects of the emails `mailer` sent to `address`."""
    return [email.subject for email in mailer.sent if email.to == (address,)]


async def _silent_enquiry(db_session: AsyncSession, prefix: str, *, age: timedelta, **columns: object) -> str:
    """A pending client enquiry `age` old with no vendor reply; returns (client id, vendor id, booking id)."""
    client_id, vendor_id = await _make_parties(db_session, prefix)
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="pending",
        payment_status="unpaid",
        event_date="2099-06-01",
        created_at=NOW - age,
        **columns,
    )
    return booking.id


# --- client no-response nudge ---------------------------------------------------------------------------


async def test_client_is_nudged_once_when_the_vendor_is_silent_for_24_hours(db_session: AsyncSession) -> None:
    """25 hours unanswered: one email to the client and a notice; a second run sends nothing."""
    booking_id = await _silent_enquiry(db_session, "nudge-due", age=timedelta(hours=25))
    mailer = FakeMailer()
    model = FakeLanguageModel()

    first = await service_reminders.send_client_no_response_nudges(db_session, mailer, model, now=NOW)
    second = await service_reminders.send_client_no_response_nudges(db_session, mailer, model, now=NOW)

    assert (first, second) == (1, 0)
    assert _sent_to(mailer, "nudge-due-client@example.com") == ["Vendor has not replied yet | Eventtz"]
    (email,) = mailer.sent
    assert "Maint nudge-due has not replied to your request for Maintenance party yet." in email.text
    assert "Requesting more than one vendor is fine until you pay." in email.text
    assert f"/client/bookings/{booking_id}" in email.text
    client_id = (await _stored(db_session, booking_id)).client_user_id
    assert [kind for kind, _body in await _notices(db_session, client_id)] == ["client_vendor_no_response"]
    row = await _stored(db_session, booking_id)
    assert row.client_user_id == client_id


async def test_no_nudge_before_24_hours_or_after_the_vendor_replied(db_session: AsyncSession) -> None:
    """23 hours unanswered, and an enquiry the vendor already answered, are left alone."""
    await _silent_enquiry(db_session, "nudge-early", age=timedelta(hours=23))
    await _silent_enquiry(
        db_session,
        "nudge-answered",
        age=timedelta(hours=30),
        vendor_first_response_at=NOW - timedelta(hours=2),
    )
    mailer = FakeMailer()

    nudged = await service_reminders.send_client_no_response_nudges(
        db_session, mailer, FakeLanguageModel(), now=NOW
    )

    assert nudged == 0
    assert mailer.sent == []


# --- pay to confirm ----------------------------------------------------------------------------------------


async def _accepted_unpaid(
    db_session: AsyncSession, prefix: str, *, accepted_ago: timedelta, event_date: str
) -> str:
    """An accepted, unpaid booking accepted `accepted_ago` before NOW; returns its id."""
    client_id, vendor_id = await _make_parties(db_session, prefix)
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        payment_status="unpaid",
        event_date=event_date,
        accepted_at=NOW - accepted_ago,
        stripe_payment_intent_id=None,
        stripe_charge_id=None,
    )
    return booking.id


async def test_pay_to_confirm_reminder_goes_out_once_24_hours_after_accepting(
    db_session: AsyncSession,
) -> None:
    """25 hours after accept: the client is told to pay once, with the baseline's headline."""
    booking_id = await _accepted_unpaid(
        db_session, "pay-due", accepted_ago=timedelta(hours=25), event_date="2030-07-01"
    )
    mailer = FakeMailer()

    first = await service_reminders.send_pay_to_confirm_reminders(db_session, mailer, now=NOW)
    second = await service_reminders.send_pay_to_confirm_reminders(db_session, mailer, now=NOW)

    assert (first, second) == (1, 0)
    assert _sent_to(mailer, "pay-due-client@example.com") == ["Maintenance party | Eventtz"]
    assert "it is not confirmed until you pay" in mailer.sent[0].text
    client_id = (await _stored(db_session, booking_id)).client_user_id
    assert [kind for kind, _body in await _notices(db_session, client_id)] == ["pay_to_confirm"]


async def test_pay_to_confirm_skips_early_paid_and_finished_events(db_session: AsyncSession) -> None:
    """23 hours after accept, an already paid booking, and an event already over get nothing."""
    await _accepted_unpaid(db_session, "pay-early", accepted_ago=timedelta(hours=23), event_date="2030-07-01")
    await _accepted_unpaid(db_session, "pay-over", accepted_ago=timedelta(hours=40), event_date="2030-06-01")
    client_id, vendor_id = await _make_parties(db_session, "pay-paid")
    await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date="2030-07-01",
        accepted_at=NOW - timedelta(hours=40),
    )
    mailer = FakeMailer()

    reminded = await service_reminders.send_pay_to_confirm_reminders(db_session, mailer, now=NOW)

    assert reminded == 0
    assert mailer.sent == []


# --- event tomorrow ---------------------------------------------------------------------------------------


async def test_event_tomorrow_tells_client_and_vendor_once(db_session: AsyncSession) -> None:
    """A paid booking on 11 June, checked on 10 June, emails both sides one time."""
    client_id, vendor_id = await _make_parties(db_session, "tomorrow")
    booking = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date="2030-06-11"
    )
    mailer = FakeMailer()

    first = await service_reminders.send_event_tomorrow_reminders(db_session, mailer, now=NOW)
    second = await service_reminders.send_event_tomorrow_reminders(db_session, mailer, now=NOW)

    assert (first, second) == (1, 0)
    assert _sent_to(mailer, "tomorrow-client@example.com") == ["Maintenance party | Eventtz"]
    assert _sent_to(mailer, "tomorrow-vendor@example.com") == ["Maintenance party | Eventtz"]
    bodies = {email.to[0]: email.text for email in mailer.sent}
    assert "your Eventtz booking is tomorrow" in bodies["tomorrow-client@example.com"]
    assert "a paid Eventtz booking is tomorrow" in bodies["tomorrow-vendor@example.com"]
    assert [kind for kind, _body in await _notices(db_session, client_id)] == ["event_tomorrow"]
    assert [kind for kind, _body in await _notices(db_session, vendor_id)] == ["vendor_event_tomorrow"]
    assert booking.id


async def test_event_tomorrow_skips_other_days_and_unpaid_bookings(db_session: AsyncSession) -> None:
    """An event today, in two days, or not yet paid is not "tomorrow"."""
    client_id, vendor_id = await _make_parties(db_session, "not-tomorrow")
    for event_date in ("2030-06-10", "2030-06-12"):
        await _make_booking(db_session, client_id=client_id, vendor_id=vendor_id, event_date=event_date)
    await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date="2030-06-11",
        payment_status="unpaid",
    )
    mailer = FakeMailer()

    reminded = await service_reminders.send_event_tomorrow_reminders(db_session, mailer, now=NOW)

    assert reminded == 0
    assert mailer.sent == []


# --- payouts setup ----------------------------------------------------------------------------------------


async def _approved_vendor(
    db_session: AsyncSession, prefix: str, *, approved_ago: timedelta, payouts_ready: bool
) -> str:
    """An approved vendor approved `approved_ago` before NOW, with or without ready payouts."""
    _client_id, vendor_id = await _make_parties(db_session, prefix)
    await vendors_repository.update_vendor(
        db_session,
        vendor_id,
        {
            "approved_at": NOW - approved_ago,
            "stripe_account_id": "acct_ready" if payouts_ready else None,
            "stripe_charges_enabled": payouts_ready,
            "stripe_payouts_enabled": payouts_ready,
        },
    )
    return vendor_id


async def test_payouts_setup_nudge_is_sent_once_24_hours_after_approval(db_session: AsyncSession) -> None:
    """25 hours after approval without payouts: one email to the vendor, then never again."""
    await _approved_vendor(db_session, "setup-due", approved_ago=timedelta(hours=25), payouts_ready=False)
    mailer = FakeMailer()

    first = await service_reminders.send_payouts_setup_nudges(db_session, mailer, now=NOW)
    second = await service_reminders.send_payouts_setup_nudges(db_session, mailer, now=NOW)

    assert (first, second) == (1, 0)
    assert _sent_to(mailer, "setup-due-vendor@example.com") == [
        "Set up payouts to go live on Eventtz | Eventtz"
    ]
    assert "Hi Maint setup-due," in mailer.sent[0].text


async def test_payouts_setup_nudge_skips_new_approvals_and_vendors_already_set_up(
    db_session: AsyncSession,
) -> None:
    """Approved 23 hours ago, or with Stripe payouts already enabled: no email."""
    await _approved_vendor(db_session, "setup-early", approved_ago=timedelta(hours=23), payouts_ready=False)
    await _approved_vendor(db_session, "setup-ready", approved_ago=timedelta(hours=40), payouts_ready=True)
    mailer = FakeMailer()

    sent = await service_reminders.send_payouts_setup_nudges(db_session, mailer, now=NOW)

    assert sent == 0
    assert mailer.sent == []


# --- the job ---------------------------------------------------------------------------------------------


async def test_the_hourly_job_runs_every_step(_engine: None) -> None:
    """One pass reports every step (nothing is due in an empty database)."""
    summary = await jobs.run_booking_maintenance_once(FakeMailer(), FakePaymentGateway(), FakeLanguageModel())

    assert summary == {
        "completion_reminders": 0,
        "payouts_released": 0,
        "stale_enquiries": 0,
        "enquiry_reminders": 0,
        "client_nudges": 0,
        "event_tomorrow": 0,
        "pay_to_confirm": 0,
        "payouts_setup": 0,
        "cancellation_policy": 0,
        "cancellation_policy_reminder": 0,
        "terms_notices": 0,
        "final_payouts": 0,
        "unpaid_expired": 0,
        "deposits_refunded": 0,
    }


# --- choose a cancellation policy ----------------------------------------------------------------------


async def test_cancellation_policy_nudge_is_sent_once_to_vendors_without_a_preset(
    db_session: AsyncSession,
) -> None:
    """An approved vendor whose form has no `cancellationPolicy`: one email, then never again."""
    await _make_parties(db_session, "policy-due")
    mailer = FakeMailer()

    first = await service_reminders.send_cancellation_policy_nudges(db_session, mailer)
    second = await service_reminders.send_cancellation_policy_nudges(db_session, mailer)

    assert (first, second) == (1, 0)
    assert _sent_to(mailer, "policy-due-vendor@example.com") == [
        "You now decide your refund policy | Eventtz"
    ]
    assert "Hi Maint policy-due," in mailer.sent[0].text
    assert "Until you pick, your profile shows Flexible." in mailer.sent[0].text


async def test_cancellation_policy_nudge_skips_vendors_who_already_chose(db_session: AsyncSession) -> None:
    """A stored preset (any of the three) means no email."""
    _client_id, vendor_id = await _make_parties(db_session, "policy-chosen")
    await vendors_repository.update_vendor(
        db_session,
        vendor_id,
        {"payload": {"businessName": "Maint policy-chosen", "cancellationPolicy": "strict"}},
    )
    mailer = FakeMailer()

    sent = await service_reminders.send_cancellation_policy_nudges(db_session, mailer)

    assert sent == 0
    assert mailer.sent == []


async def test_cancellation_policy_reminder_follows_14_days_later_and_only_once(
    db_session: AsyncSession,
) -> None:
    """First email 15 days ago, still no preset: one reminder, then never again."""
    _client_id, vendor_id = await _make_parties(db_session, "policy-remind")
    await vendors_repository.update_vendor(
        db_session, vendor_id, {"cancellation_policy_nudge_at": NOW - timedelta(days=15)}
    )
    mailer = FakeMailer()

    first = await service_reminders.send_cancellation_policy_reminders(db_session, mailer, now=NOW)
    second = await service_reminders.send_cancellation_policy_reminders(db_session, mailer, now=NOW)

    assert (first, second) == (1, 0)
    assert _sent_to(mailer, "policy-remind-vendor@example.com") == [
        "Still time to pick your refund policy | Eventtz"
    ]
    assert "You haven't picked yet" in mailer.sent[0].text


async def test_cancellation_policy_reminder_waits_14_days_and_skips_vendors_who_chose(
    db_session: AsyncSession,
) -> None:
    """Emailed 13 days ago, or emailed 20 days ago but since chose a preset: no reminder."""
    _client_id, early_id = await _make_parties(db_session, "policy-early")
    await vendors_repository.update_vendor(
        db_session, early_id, {"cancellation_policy_nudge_at": NOW - timedelta(days=13)}
    )
    _client_id, chosen_id = await _make_parties(db_session, "policy-done")
    await vendors_repository.update_vendor(
        db_session,
        chosen_id,
        {
            "cancellation_policy_nudge_at": NOW - timedelta(days=20),
            "payload": {"businessName": "Maint policy-done", "cancellationPolicy": "moderate"},
        },
    )
    mailer = FakeMailer()

    sent = await service_reminders.send_cancellation_policy_reminders(db_session, mailer, now=NOW)

    assert sent == 0
    assert mailer.sent == []
