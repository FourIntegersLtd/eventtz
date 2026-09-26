"""The vendor's own analytics: enquiries, the booking funnel, revenue, ratings and reply times."""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.features.marketplace import repository_explore
from app.features.marketplace.domain_metrics import vendor_analytics

# The shortest and longest periods the screen offers, in days.
MIN_PERIOD_DAYS = 7
MAX_PERIOD_DAYS = 365


async def analytics_for(session: AsyncSession, vendor: Principal, days: int) -> dict[str, Any]:
    """The analytics screen for the last `days` days, counting today (UTC)."""
    days = max(MIN_PERIOD_DAYS, min(days, MAX_PERIOD_DAYS))
    today = datetime.now(UTC).date()
    since = datetime.combine(today - timedelta(days=days - 1), time.min, tzinfo=UTC)
    return vendor_analytics(
        days=days,
        today=today,
        enquiries=await repository_explore.client_enquiries_since(session, vendor.id, since),
        ratings=await repository_explore.ratings_since(session, vendor.id, since),
        profile_views=await repository_explore.profile_views_since(session, vendor.id, since),
    )
