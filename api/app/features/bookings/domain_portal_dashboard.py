"""Pure helpers for client and vendor home dashboards (agenda, calendar map, counts)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, TypeVar

ListItem = TypeVar("ListItem")


def _date_key_from_iso(iso: str | None) -> str | None:
    """`YYYY-MM-DD` from an ISO datetime string, or `None` when missing."""
    if not iso or len(iso) < 10:
        return None
    return iso[:10]


def _noon_utc(day_key: str) -> datetime:
    """Noon UTC on a calendar day key (avoids DST edge cases when comparing dates)."""
    return datetime.fromisoformat(f"{day_key}T12:00:00").replace(tzinfo=UTC)


def _local_today_key() -> str:
    """Today's date in the server's local timezone as `YYYY-MM-DD`."""
    today = datetime.now(UTC).astimezone().date()
    return today.isoformat()


def pick_next_upcoming(active: list[Any]) -> Any | None:
    """The soonest upcoming active booking, or the earliest by date if none are future."""
    if not active:
        return None
    today_key = _local_today_key()
    today_noon = _noon_utc(today_key)
    scored: list[tuple[float, Any]] = []
    for booking in active:
        start_key = _date_key_from_iso(getattr(booking, "event_date", None))
        if not start_key:
            continue
        scored.append((_noon_utc(start_key).timestamp(), booking))
    if not scored:
        return None
    future = [pair for pair in scored if pair[0] >= today_noon.timestamp()]
    future.sort(key=lambda pair: pair[0])
    if future:
        return future[0][1]
    scored.sort(key=lambda pair: pair[0])
    return scored[0][1]


def _booking_status(booking: Any) -> str | None:
    """Lifecycle status from either client or vendor list row shapes."""
    return getattr(booking, "booking_status", None) or getattr(booking, "status", None)


def accepted_upcoming(active: list[Any]) -> list[Any]:
    """Accepted bookings whose event window has not fully ended before today."""
    today_key = _local_today_key()
    today_noon = _noon_utc(today_key)
    accepted = [booking for booking in active if _booking_status(booking) == "accepted"]
    upcoming: list[Any] = []
    for booking in accepted:
        start_key = _date_key_from_iso(getattr(booking, "event_date", None))
        if not start_key:
            continue
        end_key = _date_key_from_iso(getattr(booking, "event_end_date", None)) or start_key
        if _noon_utc(end_key).timestamp() >= today_noon.timestamp():
            upcoming.append(booking)
    return upcoming


def bookings_by_date(accepted_upcoming_rows: list[Any]) -> dict[str, list[Any]]:
    """Map each local date key to bookings spanning that day (multi-day events included)."""
    today_key = _local_today_key()
    today_noon = _noon_utc(today_key)
    by_date: dict[str, list[Any]] = {}
    for booking in accepted_upcoming_rows:
        start_key = _date_key_from_iso(getattr(booking, "event_date", None))
        if not start_key:
            continue
        end_key = _date_key_from_iso(getattr(booking, "event_end_date", None)) or start_key
        start = datetime.fromisoformat(start_key).date()
        end = datetime.fromisoformat(end_key).date()
        day = start
        while day <= end:
            key = day.isoformat()
            if _noon_utc(key).timestamp() >= today_noon.timestamp():
                by_date.setdefault(key, []).append(booking)
            day += timedelta(days=1)
    return by_date


def upcoming_agenda(accepted_upcoming_rows: list[Any], *, limit: int = 5) -> list[Any]:
    """Upcoming accepted bookings sorted by start date."""

    def sort_key(booking: Any) -> str:
        """Sort key: event start date, or far future when unknown."""
        return _date_key_from_iso(getattr(booking, "event_date", None)) or "9999-12-31"

    return sorted(accepted_upcoming_rows, key=sort_key)[:limit]
