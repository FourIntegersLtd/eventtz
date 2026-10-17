"""Rescheduling: request, accept, decline, withdraw, who may answer, and a full day blocking the move.

These call the service with the test's session and fakes, like the other booking
tests. The capacity trigger is the real one in the migrated database.
"""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import service_date_change
from app.features.bookings.errors import (
    DateChangeCapacityFull,
    DateChangeNotAllowed,
    DateChangeNotYours,
    DateChangePending,
    NoDateChange,
)
from app.features.vendors import repository as vendors_repository
from tests.http.test_bookings_maintenance import _make_booking, _make_parties, _notices, _stored
from tests.support.fakes import FakeMailer

pytestmark = [pytest.mark.db]

ORIGINAL = "2099-06-01"
PROPOSED = date(2099, 7, 1)


async def _accepted(db_session: AsyncSession, prefix: str, **columns: object) -> tuple[str, str, str]:
    """An accepted, unpaid booking on ORIGINAL with a Strict policy; returns (client, vendor, booking ids)."""
    client_id, vendor_id = await _make_parties(db_session, prefix)
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        event_date=ORIGINAL,
        payment_status="unpaid",
        cancellation_policy="strict",
        **columns,
    )
    return client_id, vendor_id, booking.id


async def test_accepted_request_moves_the_date_and_keeps_price_and_policy(db_session: AsyncSession) -> None:
    """The vendor accepts the client's request: dates move, proposal clears, money terms are untouched."""
    client_id, vendor_id, booking_id = await _accepted(db_session, "dc-accept")
    before = await _stored(db_session, booking_id)
    mailer = FakeMailer()

    await service_date_change.request_date_change(
        db_session, mailer, "client", client_id, booking_id, PROPOSED, None, "Venue flooded"
    )
    pending = await _stored(db_session, booking_id)
    assert (pending.event_date[:10], pending.proposed_event_date, pending.date_change_requested_by) == (
        ORIGINAL,
        "2099-07-01",
        "client",
    )
    assert pending.date_change_note == "Venue flooded"
    assert [kind for kind, _ in await _notices(db_session, vendor_id)] == ["date_change_requested"]

    await service_date_change.respond_to_date_change(
        db_session, mailer, "vendor", vendor_id, booking_id, accept=True
    )

    after = await _stored(db_session, booking_id)
    assert after.event_date[:10] == "2099-07-01"
    assert (after.proposed_event_date, after.date_change_requested_by, after.date_change_note) == (None,) * 3
    assert (after.total_label, after.cancellation_policy, after.payment_status, after.payment_amount_gbp) == (
        before.total_label,
        "strict",
        before.payment_status,
        before.payment_amount_gbp,
    )
    assert [kind for kind, _ in await _notices(db_session, client_id)] == ["date_change_accepted"]


async def test_decline_keeps_the_original_date(db_session: AsyncSession) -> None:
    """A declined request clears the proposal and leaves the date alone."""
    client_id, vendor_id, booking_id = await _accepted(db_session, "dc-decline")
    mailer = FakeMailer()
    await service_date_change.request_date_change(
        db_session, mailer, "vendor", vendor_id, booking_id, PROPOSED, None, None
    )

    await service_date_change.respond_to_date_change(
        db_session, mailer, "client", client_id, booking_id, accept=False
    )

    stored = await _stored(db_session, booking_id)
    assert (stored.event_date[:10], stored.proposed_event_date) == (ORIGINAL, None)
    assert [kind for kind, _ in await _notices(db_session, vendor_id)] == ["date_change_declined"]


async def test_requester_can_withdraw_and_only_once(db_session: AsyncSession) -> None:
    """Withdrawing clears the proposal and tells the other side; a second pending request is refused."""
    client_id, vendor_id, booking_id = await _accepted(db_session, "dc-withdraw")
    mailer = FakeMailer()
    await service_date_change.request_date_change(
        db_session, mailer, "client", client_id, booking_id, PROPOSED, None, None
    )
    with pytest.raises(DateChangePending):
        await service_date_change.request_date_change(
            db_session, mailer, "vendor", vendor_id, booking_id, PROPOSED, None, None
        )

    await service_date_change.withdraw_date_change(db_session, mailer, "client", client_id, booking_id)

    assert (await _stored(db_session, booking_id)).proposed_event_date is None
    assert "date_change_withdrawn" in [kind for kind, _ in await _notices(db_session, vendor_id)]
    with pytest.raises(NoDateChange):
        await service_date_change.withdraw_date_change(db_session, mailer, "client", client_id, booking_id)


async def test_only_the_other_party_responds_and_only_the_requester_withdraws(
    db_session: AsyncSession,
) -> None:
    """The requester cannot answer their own request; the other side cannot withdraw it."""
    client_id, vendor_id, booking_id = await _accepted(db_session, "dc-roles")
    mailer = FakeMailer()
    await service_date_change.request_date_change(
        db_session, mailer, "client", client_id, booking_id, PROPOSED, None, None
    )

    with pytest.raises(DateChangeNotYours):
        await service_date_change.respond_to_date_change(
            db_session, mailer, "client", client_id, booking_id, accept=True
        )
    with pytest.raises(DateChangeNotYours):
        await service_date_change.withdraw_date_change(db_session, mailer, "vendor", vendor_id, booking_id)


async def test_pending_booking_cannot_be_rescheduled(db_session: AsyncSession) -> None:
    """Only accepted bookings can be moved."""
    client_id, _vendor_id, booking_id = await _accepted(db_session, "dc-notallowed", status="pending")

    with pytest.raises(DateChangeNotAllowed):
        await service_date_change.request_date_change(
            db_session, FakeMailer(), "client", client_id, booking_id, PROPOSED, None, None
        )


async def test_full_day_blocks_the_move(db_session: AsyncSession) -> None:
    """The vendor is at their daily cap on the proposed day: accepting fails and nothing moves."""
    client_id, vendor_id = await _make_parties(db_session, "dc-full")
    # Cap is 20 in _make_parties; lower it to 1 so one other booking fills the day.
    await vendors_repository.save_profile(
        db_session,
        vendor_id,
        {"payload": {"businessName": "Maint dc-full", "maxBookingsPerDay": "1"}},
        exists=True,
    )
    mine = await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date=ORIGINAL, payment_status="unpaid"
    )
    await _make_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_date="2099-07-01", payment_status="unpaid"
    )
    mailer = FakeMailer()
    await service_date_change.request_date_change(
        db_session, mailer, "client", client_id, mine.id, PROPOSED, None, None
    )

    with pytest.raises(DateChangeCapacityFull):
        await service_date_change.respond_to_date_change(
            db_session, mailer, "vendor", vendor_id, mine.id, accept=True
        )

    stored = await _stored(db_session, mine.id)
    assert (stored.event_date[:10], stored.proposed_event_date) == (ORIGINAL, "2099-07-01")
