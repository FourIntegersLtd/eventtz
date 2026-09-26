"""The feed's reads against real Postgres: event names, disputes on the user's bookings, mark-read.

`booking_requests` and `dispute_cases` are not mapped yet, so the rows are seeded
with plain SQL here.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import repository as identity_repository
from app.features.notifications import repository, repository_bookings

pytestmark = pytest.mark.db


async def new_user(session: AsyncSession, email: str, user_type: str) -> str:
    """A `users` row for one side of a booking."""
    user_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=None,
        account_suspended=False,
    )
    assert user_id is not None
    return user_id


async def new_booking(
    session: AsyncSession, *, client_id: str, vendor_id: str, event_name: str, event_date: str = "2099-06-01"
) -> str:
    """A minimal `booking_requests` row (one per vendor per day: the daily-capacity trigger)."""
    booking_id = await session.scalar(
        text(
            "insert into booking_requests"
            " (client_user_id, vendor_user_id, event_name, event_date, total_label)"
            " values (:client_id, :vendor_id, :event_name, cast(:event_date as date), 'GBP 100')"
            " returning id"
        ),
        {"client_id": client_id, "vendor_id": vendor_id, "event_name": event_name, "event_date": event_date},
    )
    return str(booking_id)


async def new_dispute(
    session: AsyncSession, *, booking_id: str, opened_by: str, status: str, updated_at: str
) -> None:
    """A `dispute_cases` row on the booking, last updated at `updated_at`."""
    await session.execute(
        text(
            "insert into dispute_cases (booking_request_id, opened_by_user_id, status, summary, updated_at)"
            " values (:booking_id, :opened_by, :status, 'Late arrival', :updated_at)"
        ),
        {"booking_id": booking_id, "opened_by": opened_by, "status": status, "updated_at": updated_at},
    )


async def test_disputes_are_those_on_the_users_bookings_most_recently_updated_first(
    db_session: AsyncSession,
) -> None:
    """Both parties see a dispute; a stranger sees none; blank event names are left out."""
    client_id = await new_user(db_session, "feed-client@example.com", "client")
    vendor_id = await new_user(db_session, "feed-vendor@example.com", "vendor")
    stranger_id = await new_user(db_session, "feed-stranger@example.com", "client")
    named = await new_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_name="  Ada's 30th "
    )
    blank = await new_booking(
        db_session, client_id=client_id, vendor_id=vendor_id, event_name="  ", event_date="2099-06-02"
    )
    await new_dispute(
        db_session, booking_id=named, opened_by=client_id, status="open", updated_at="2026-09-01T00:00:00Z"
    )
    await new_dispute(
        db_session,
        booking_id=blank,
        opened_by=vendor_id,
        status="under_review",
        updated_at="2026-09-02T00:00:00Z",
    )

    assert await repository_bookings.event_names(db_session, [named, blank, "not-a-uuid"]) == {
        named: "Ada's 30th"
    }
    for party_id in (client_id, vendor_id):
        disputes = await repository_bookings.latest_disputes_for_party(db_session, party_id, limit=10)
        assert [(dispute.status, dispute.updated_at) for dispute in disputes] == [
            ("under_review", "2026-09-02T00:00:00+00:00"),
            ("open", "2026-09-01T00:00:00+00:00"),
        ]
    assert await repository_bookings.latest_disputes_for_party(db_session, stranger_id, limit=10) == []


async def test_mark_read_touches_only_the_callers_own_unread_notices(db_session: AsyncSession) -> None:
    """Another user's id, or a malformed one, changes nothing; mark-all clears only the caller's."""
    client_id = await new_user(db_session, "notice-client@example.com", "client")
    vendor_id = await new_user(db_session, "notice-vendor@example.com", "vendor")
    booking_id = await new_booking(db_session, client_id=client_id, vendor_id=vendor_id, event_name="Party")
    for user_id, kind in ((client_id, "booking_accepted"), (vendor_id, "vendor_payment_received")):
        await db_session.execute(
            text(
                "insert into booking_notifications (user_id, booking_id, kind)"
                " values (:user_id, :booking_id, :kind)"
            ),
            {"user_id": user_id, "booking_id": booking_id, "kind": kind},
        )
    (client_notice,) = await repository.latest_for_user(db_session, client_id, limit=20)

    assert not await repository.mark_read(db_session, user_id=vendor_id, notification_id=client_notice.id)
    assert not await repository.mark_read(db_session, user_id=client_id, notification_id="not-a-uuid")
    assert await repository.count_unread(db_session, client_id) == 1
    assert await repository.mark_read(db_session, user_id=client_id, notification_id=client_notice.id)
    assert await repository.count_unread(db_session, client_id) == 0

    await repository.mark_all_read(db_session, client_id)
    assert await repository.count_unread(db_session, vendor_id) == 1
