"""Calendar dates in the platform home timezone (UK), so "today" ignores the server clock zone."""

from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

#: Eventtz is a UK marketplace: a booking's "today" is the London calendar day.
HOME_TIMEZONE = ZoneInfo("Europe/London")


def uk_date(moment: datetime) -> date:
    """The London calendar date of an aware instant (BST makes 23:30 UTC in summer the next day)."""
    return moment.astimezone(HOME_TIMEZONE).date()


def uk_today(now: datetime | None = None) -> date:
    """Today's London calendar date; `now` is the clock tests set (an aware instant), default the real one."""
    return uk_date(now or datetime.now(UTC))
