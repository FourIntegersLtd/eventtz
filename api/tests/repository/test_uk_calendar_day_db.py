"""Day boundaries that need Postgres: a planned event and the admin funnel both use the London day."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

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
