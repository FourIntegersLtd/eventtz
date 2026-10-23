"""Day boundaries that need Postgres: a planned event and the admin funnel both use the London day."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.admin_insights import domain as insights_domain
from app.features.admin_insights import repository as insights_repository
from app.features.admin_insights import service as insights_service
from app.features.planner import repository as planner_repository
from app.features.planner import service_plans
from tests.repository.test_booking_writes import new_user

pytestmark = pytest.mark.db

#: 30 June 2026 23:30 UTC is 00:30 BST on 1 July in London.
JUST_PAST_LONDON_MIDNIGHT = datetime(2026, 6, 30, 23, 30, tzinfo=UTC)


async def test_a_plan_becomes_an_event_dated_the_london_day(db_session: AsyncSession) -> None:
    """Turning a plan into an event at 00:30 BST on 1 July dates it 1 July, not 30 June."""
    client_id = await new_user(db_session, "uk-day-planner@example.com", "client")
    plan = await planner_repository.insert_plan(
        db_session,
        client_user_id=client_id,
        title="Birthday",
        raw_prompt="a birthday",
        brief={},
        confidence_score=None,
        confidence_reasons=None,
        summary=None,
        budget_total_gbp=None,
        budget_remaining_gbp=None,
    )
    ensured = await service_plans.ensure_client_event_for_plan(
        db_session, client_id, plan.id, now=JUST_PAST_LONDON_MIDNIGHT
    )
    assert str(ensured.event_date)[:10] == "2026-07-01"


async def test_the_admin_funnel_defaults_to_the_window_ending_on_the_london_day(
    db_session: AsyncSession,
) -> None:
    """With no range, the funnel ends on 1 July and starts 29 days earlier."""
    funnel = await insights_service.marketplace_analytics(
        db_session, from_date_raw=None, to_date_raw=None, now=JUST_PAST_LONDON_MIDNIGHT
    )
    assert (funnel.from_date, funnel.to_date) == ("2026-06-02", date(2026, 7, 1).isoformat())


async def test_signups_at_23_30_utc_land_in_the_next_london_day_bucket(db_session: AsyncSession) -> None:
    """An account created 23:30 UTC on 30 June is counted under 1 July, and 1 July's range reaches it."""
    client_id = await new_user(db_session, "uk-day-signup@example.com", "client")
    await db_session.execute(
        text("update users set created_at = :moment where id = :id"),
        {"moment": JUST_PAST_LONDON_MIDNIGHT, "id": client_id},
    )
    days = insights_domain.date_range(2, JUST_PAST_LONDON_MIDNIGHT)
    assert days == ["2026-06-30", "2026-07-01"]
    rows = await insights_repository.signups_in_range(db_session, days)
    buckets = insights_domain.build_signup_buckets(days, rows)
    assert [(bucket["date"], bucket["clients"]) for bucket in buckets] == [
        ("2026-06-30", 0),
        ("2026-07-01", 1),
    ]


async def test_financials_daily_table_counts_a_23_30_utc_payment_on_the_london_day(
    db_session: AsyncSession,
) -> None:
    """A booking paid 23:30 UTC on 30 June is read by the 1 July London day and bucketed under 1 July."""
    from datetime import date as date_type

    from app.features.bookings import repository as bookings_repository
    from app.features.bookings import repository_admin
    from tests.repository.test_booking_writes import booking_values

    client_id = await new_user(db_session, "uk-day-pay-client@example.com", "client")
    vendor_id = await new_user(db_session, "uk-day-pay-vendor@example.com", "vendor")
    booking = await bookings_repository.insert_booking(
        db_session, booking_values(client_id, vendor_id, date(2099, 6, 1))
    )
    booking_id = booking.id
    await db_session.execute(
        text("update booking_requests set payment_status = 'paid', paid_at = :moment where id = :id"),
        {"moment": JUST_PAST_LONDON_MIDNIGHT, "id": booking_id},
    )
    july_first = date_type(2026, 7, 1)
    june_thirtieth = date_type(2026, 6, 30)
    in_july = await repository_admin.paid_bookings_for_financials(
        db_session, date_from=None, date_to=None, paid_on_or_after=july_first, paid_on_or_before=july_first
    )
    in_june = await repository_admin.paid_bookings_for_financials(
        db_session,
        date_from=None,
        date_to=None,
        paid_on_or_after=june_thirtieth,
        paid_on_or_before=june_thirtieth,
    )
    assert [booking.id for booking in in_july] == [booking_id]
    assert in_june == []
