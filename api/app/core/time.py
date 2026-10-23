"""Calendar dates in the platform home timezone (UK), so "today" ignores the server clock zone."""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

#: Eventtz is a UK marketplace: a booking's "today" is the London calendar day.
HOME_TIMEZONE = ZoneInfo("Europe/London")


def london_midnight_utc(day: date) -> datetime:
    """The UTC instant at which London's calendar `day` begins (23:00 UTC the day before in summer).

    Event-day clocks (payment deadline, delivery, deposit) are measured from London midnight. Convert
    to UTC here, then add or subtract hours on the UTC value: `timedelta` on a London-aware datetime
    counts wall-clock time, so a window across a clock change would come out an hour out. To move by
    whole days, add them to `day` first, then call this, so the result still lands on London midnight.
    """
    return datetime.combine(day, time.min, tzinfo=HOME_TIMEZONE).astimezone(UTC)


def uk_date(moment: datetime) -> date:
    """The London calendar date of an aware instant (BST makes 23:30 UTC in summer the next day)."""
    return moment.astimezone(HOME_TIMEZONE).date()


def uk_day_key(iso_timestamp: object) -> str | None:
    """The London `YYYY-MM-DD` of an ISO timestamp (no offset means UTC), or `None` if blank or unreadable."""
    if not iso_timestamp:
        return None
    try:
        moment = datetime.fromisoformat(str(iso_timestamp).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return uk_date(moment if moment.tzinfo else moment.replace(tzinfo=UTC)).isoformat()


def uk_today(now: datetime | None = None) -> date:
    """Today's London calendar date; `now` is the clock tests set (an aware instant), default the real one."""
    return uk_date(now or datetime.now(UTC))
