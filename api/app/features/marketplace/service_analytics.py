"""The vendor's own analytics: enquiries, the booking funnel, revenue, ratings and reply times."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.time import HOME_TIMEZONE, uk_today
from app.features.marketplace import repository_explore
from app.features.marketplace.domain_metrics import vendor_analytics

# The shortest and longest periods the screen offers, in days.
MIN_PERIOD_DAYS = 7
MAX_PERIOD_DAYS = 365


def period_start(days: int, now: datetime | None = None) -> tuple[date, datetime]:
    """London today and the instant the `days`-day window opens (London midnight of its first day)."""
    today = uk_today(now)
    return today, datetime.combine(today - timedelta(days=days - 1), time.min, tzinfo=HOME_TIMEZONE)


async def analytics_for(
    session: AsyncSession, vendor: Principal, days: int, now: datetime | None = None
) -> dict[str, Any]:
    """The analytics screen for the last `days` days, counting today (London)."""
    days = max(MIN_PERIOD_DAYS, min(days, MAX_PERIOD_DAYS))
    today, since = period_start(days, now)
    return vendor_analytics(
        days=days,
        today=today,
        enquiries=await repository_explore.client_enquiries_since(session, vendor.id, since),
        ratings=await repository_explore.ratings_since(session, vendor.id, since),
        profile_views=await repository_explore.profile_views_since(session, vendor.id, since),
    )
