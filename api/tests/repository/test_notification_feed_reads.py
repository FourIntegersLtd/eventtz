"""The feed's reads against real Postgres: event names, disputes on the user's bookings, mark-read.

`booking_requests` and `dispute_cases` are not mapped yet, so the rows are seeded
with plain SQL here.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.features.identity import repository as identity_repository
from app.features.notifications import repository, repository_bookings, service_feed
from app.features.notifications.domain_feed import topic_scope

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
        disputes, total = await repository_bookings.feed_lines(
            db_session, party_id, scope=topic_scope("all"), unread_only=False, offset=0, limit=10
        )
        assert total == 2
        assert [(dispute.status, dispute.updated_at) for dispute in disputes] == [
            ("under_review", "2026-09-02T00:00:00+00:00"),
            ("open", "2026-09-01T00:00:00+00:00"),
        ]
    assert await repository_bookings.feed_lines(
        db_session, stranger_id, scope=topic_scope("all"), unread_only=False, offset=0, limit=10
    ) == ([], 0)


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


async def seed_notice(
    session: AsyncSession, *, user_id: str, booking_id: str, kind: str, age_minutes: int, read: bool
) -> None:
    """A notice created `age_minutes` ago (unique per booking and kind), read or unread."""
    await session.execute(
        text(
            "insert into booking_notifications (user_id, booking_id, kind, created_at, read_at)"
            " values (:user_id, :booking_id, :kind, now() - make_interval(mins => :age),"
            " case when :read then now() else null end)"
        ),
        {"user_id": user_id, "booking_id": booking_id, "kind": kind, "age": age_minutes, "read": read},
    )


async def test_feed_pages_and_totals_are_exact_beyond_the_first_25_items(db_session: AsyncSession) -> None:
    """Filters and paging run in SQL: page 2 of `unread` and of `payments` holds older matches.

    60 notices on 60 bookings, newest first by index. Even indexes are unread, every
    third is a payment kind, so the matches reach well past the newest 25 items.
    """
    client_id = await new_user(db_session, "paging-client@example.com", "client")
    vendor_id = await new_user(db_session, "paging-vendor@example.com", "vendor")
    payment_kinds = ("payment_received", "payment_refunded", "deposit_refunded")
    expected: list[tuple[str, str, bool]] = []
    for index in range(60):
        booking_id = await new_booking(
            db_session,
            client_id=client_id,
            vendor_id=vendor_id,
            event_name=f"Party {index}",
            event_date=f"2099-{1 + index // 28:02d}-{1 + index % 28:02d}",
        )
        kind = payment_kinds[index % 3] if index % 3 == 0 else "booking_accepted"
        read = index % 2 == 1
        await seed_notice(
            db_session, user_id=client_id, booking_id=booking_id, kind=kind, age_minutes=index, read=read
        )
        expected.append((f"Party {index}", kind, read))
    principal = Principal(id=client_id, email=None, user_type="client")

    async def page(read_state: str, topic: str, offset: int, limit: int = 10) -> tuple[list[str], int]:
        """The titles on one feed page and the feed's total."""
        items, total = await service_feed.feed_page(
            db_session,
            principal,
            portal="client",
            offset=offset,
            limit=limit,
            read_state=read_state,  # type: ignore[arg-type]
            topic=topic,  # type: ignore[arg-type]
        )
        return [item.title for item in items], total

    unread = [name for name, _kind, read in expected if not read]
    assert len(unread) == 30
    assert await page("unread", "all", 10) == (unread[10:20], 30)
    assert await page("unread", "all", 25, limit=10) == (unread[25:30], 30)
    payments = [name for name, kind, _read in expected if kind in payment_kinds]
    assert len(payments) == 20
    assert await page("all", "payments", 10) == (payments[10:20], 20)
    both = [name for name, kind, read in expected if kind in payment_kinds and not read]
    assert await page("unread", "payments", 0) == (both[:10], len(both))
    everything_booking = [name for name, _kind, _read in expected]
    assert await page("all", "bookings", 30) == (everything_booking[30:40], 60)
    everything = [name for name, _kind, _read in expected]
    assert await page("all", "all", 50) == (everything[50:60], 60)
    assert await page("all", "messages", 0) == ([], 0)
    assert await page("all", "all", 60) == ([], 60)


async def test_feed_merges_disputes_by_time_and_puts_unread_chat_last(db_session: AsyncSession) -> None:
    """A dispute sits among the notices by its update time; unread-only has no disputes; chat is last."""
    client_id = await new_user(db_session, "merge-client@example.com", "client")
    vendor_id = await new_user(db_session, "merge-vendor@example.com", "vendor")
    booking_id = await new_booking(db_session, client_id=client_id, vendor_id=vendor_id, event_name="Merge")
    await seed_notice(
        db_session,
        user_id=client_id,
        booking_id=booking_id,
        kind="booking_accepted",
        age_minutes=60,
        read=False,
    )
    await seed_notice(
        db_session,
        user_id=client_id,
        booking_id=booking_id,
        kind="payment_received",
        age_minutes=10,
        read=False,
    )
    await new_dispute(
        db_session,
        booking_id=booking_id,
        opened_by=client_id,
        status="open",
        updated_at="2026-01-01T00:00:00Z",
    )
    principal = Principal(id=client_id, email=None, user_type="client")

    items, total = await service_feed.feed_page(db_session, principal, portal="client", offset=0, limit=10)
    assert [item.kind for item in items] == ["booking_update", "booking_update", "dispute_update"]
    assert total == 3
    unread_items, unread_total = await service_feed.feed_page(
        db_session, principal, portal="client", offset=0, limit=10, read_state="unread"
    )
    assert [item.kind for item in unread_items] == ["booking_update", "booking_update"]
    assert unread_total == 2
    bookings_items, bookings_total = await service_feed.feed_page(
        db_session, principal, portal="client", offset=0, limit=10, topic="bookings"
    )
    assert [item.kind for item in bookings_items] == ["booking_update", "booking_update", "dispute_update"]
    assert bookings_total == 3
    payments_items, payments_total = await service_feed.feed_page(
        db_session, principal, portal="client", offset=0, limit=10, topic="payments"
    )
    assert [item.kind for item in payments_items] == ["booking_update"]
    assert payments_total == 1
    # The vendor writes to the client: the summary is the feed's last item, counted in the total.
    thread_id = await db_session.scalar(
        text(
            "insert into conversations (kind, client_user_id, vendor_user_id)"
            " values ('dm', :client_id, :vendor_id) returning id"
        ),
        {"client_id": client_id, "vendor_id": vendor_id},
    )
    await db_session.execute(
        text("insert into messages (conversation_id, sender_user_id, body) values (:thread, :sender, 'Hi')"),
        {"thread": thread_id, "sender": vendor_id},
    )
    items, total = await service_feed.feed_page(db_session, principal, portal="client", offset=0, limit=10)
    assert [item.kind for item in items][-1] == "chat_unread_summary"
    assert total == 4
    first_page, _ = await service_feed.feed_page(db_session, principal, portal="client", offset=0, limit=2)
    last_page, last_total = await service_feed.feed_page(
        db_session, principal, portal="client", offset=2, limit=2
    )
    assert [item.kind for item in first_page] == ["booking_update", "booking_update"]
    assert [item.kind for item in last_page] == ["dispute_update", "chat_unread_summary"]
    assert last_total == 4
    messages_items, messages_total = await service_feed.feed_page(
        db_session, principal, portal="client", offset=0, limit=10, topic="messages"
    )
    assert [item.kind for item in messages_items] == ["chat_unread_summary"]
    assert messages_total == 1
