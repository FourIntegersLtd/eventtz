"""Vendor cancellation counts and the pause-aware public listing, against real Postgres."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import OutgoingEmail
from app.features.bookings import repository, repository_admin
from app.features.vendors import repository as vendor_repository
from app.features.vendors import service_moderation
from tests.repository.test_booking_writes import new_pair, new_user
from tests.support.fakes import FakeMailer

pytestmark = pytest.mark.db

SINCE = datetime.now(UTC) - timedelta(days=180)
_next_day = [0]


async def new_booking(session: AsyncSession, client_id: str, vendor_id: str, **extra: object) -> str:
    """A booking for `vendor_id` on its own day, with `extra` columns (cancelled_by, paid_at, ...)."""
    _next_day[0] += 1
    booking = await repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Party",
            "event_date": date(2099, 1, 1) + timedelta(days=_next_day[0]),
            "total_label": "GBP 100.00",
            "status": "cancelled",
            **extra,
        },
    )
    return booking.id


async def test_only_paid_non_exceptional_vendor_cancellations_in_the_window_count(
    db_session: AsyncSession,
) -> None:
    """Two countable cancellations plus a no-show dispute give 3; the rest are ignored."""
    client_id, vendor_id = await new_pair(db_session)
    now = datetime.now(UTC)
    paid = {"cancelled_by": "vendor", "cancelled_at": now, "paid_at": now, "payment_status": "refunded"}
    await new_booking(db_session, client_id, vendor_id, **paid)
    await new_booking(db_session, client_id, vendor_id, **{**paid, "payment_status": "partially_refunded"})
    await new_booking(db_session, client_id, vendor_id, **{**paid, "cancellation_reason": "exceptional"})
    await new_booking(db_session, client_id, vendor_id, **{**paid, "cancelled_by": "client"})
    await new_booking(db_session, client_id, vendor_id, **{**paid, "cancelled_at": now - timedelta(days=200)})
    await new_booking(
        db_session,
        client_id,
        vendor_id,
        cancelled_by="vendor",
        cancelled_at=now,
        payment_status="unpaid",
    )
    no_show_booking = await new_booking(db_session, client_id, vendor_id, **{**paid, "cancelled_by": None})
    await db_session.execute(
        text(
            "insert into dispute_cases (booking_request_id, opened_by_user_id, status, summary,"
            " resolution_action, resolved_at) values (:booking, :opener, 'resolved', 'No show',"
            " 'vendor_no_show', now())"
        ),
        {"booking": no_show_booking, "opener": client_id},
    )
    counts = await repository_admin.vendor_cancellation_counts(db_session, [vendor_id], since=SINCE)
    assert counts == {vendor_id: 3}


async def test_a_vendor_with_no_cancellations_is_absent_from_the_counts(db_session: AsyncSession) -> None:
    """Callers read a missing vendor as zero."""
    _, vendor_id = await new_pair(db_session)
    assert await repository_admin.vendor_cancellation_counts(db_session, [vendor_id], since=SINCE) == {}


async def test_a_paused_vendor_leaves_the_public_listing_until_the_pause_lapses(
    db_session: AsyncSession,
) -> None:
    """A future `listing_paused_until` hides an otherwise listed vendor; a past one does not."""
    vendor_id = await new_user(db_session, "pause-vendor@example.com", "vendor")
    await vendor_repository.save_profile(
        db_session,
        vendor_id,
        {"status": "submitted", "approval_status": "approved", "listing_override": "visible", "payload": {}},
        exists=False,
    )

    async def listed_ids() -> list[str]:
        """The ids the public marketplace listing returns for this vendor."""
        rows = await vendor_repository.marketplace_vendors(db_session, listed_only=True, user_ids=[vendor_id])
        return [row.user_id for row in rows]

    assert await listed_ids() == [vendor_id]
    await vendor_repository.update_vendor(
        db_session, vendor_id, {"listing_paused_until": datetime.now(UTC) + timedelta(days=3)}
    )
    assert await listed_ids() == []
    await vendor_repository.update_vendor(
        db_session, vendor_id, {"listing_paused_until": datetime.now(UTC) - timedelta(days=1)}
    )
    assert await listed_ids() == [vendor_id]


async def test_pausing_a_listing_hides_it_emails_the_vendor_and_clearing_restores_it(
    db_session: AsyncSession,
) -> None:
    """The service stores the pause, sends one email with the reason, and clearing ends it."""
    vendor_id = await new_user(db_session, "pause-service@example.com", "vendor")
    staff_id = await new_user(db_session, "pause-staff@example.com", "admin")
    await vendor_repository.save_profile(
        db_session,
        vendor_id,
        {"status": "submitted", "approval_status": "approved", "listing_override": "visible", "payload": {}},
        exists=False,
    )
    staff_member = Principal(id=staff_id, email=None, user_type="admin", admin_role="super_admin")
    mailer = FakeMailer()
    paused = await service_moderation.pause_listing(
        db_session, staff_member, vendor_id, days=7, reason="Two late cancellations", mailer=mailer
    )
    assert paused.listing_visible is False
    sent: list[OutgoingEmail] = mailer.sent
    assert len(sent) == 1
    assert "Two late cancellations" in (sent[0].text or "")
    cleared = await service_moderation.clear_listing_pause(db_session, staff_member, vendor_id)
    assert cleared.listing_visible is True
