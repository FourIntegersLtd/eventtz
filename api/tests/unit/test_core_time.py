"""London calendar dates around the UK midnight boundary, and the dashboard's use of them."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

from app.core.time import uk_date
from app.features.bookings import domain_portal_dashboard as dashboard


@dataclass
class Booking:
    """A minimal booking row: just the fields the dashboard helpers read."""

    event_date: str
    booking_status: str = "accepted"
    event_end_date: str | None = None


def test_summer_late_evening_utc_is_already_tomorrow_in_london() -> None:
    """23:30 UTC on 30 June is 00:30 BST on 1 July."""
    assert uk_date(datetime(2026, 6, 30, 23, 30, tzinfo=UTC)) == date(2026, 7, 1)


def test_summer_just_before_london_midnight_is_still_today() -> None:
    """22:59 UTC on 30 June is 23:59 BST, still 30 June."""
    assert uk_date(datetime(2026, 6, 30, 22, 59, tzinfo=UTC)) == date(2026, 6, 30)


def test_winter_utc_and_london_dates_agree() -> None:
    """In GMT the two calendars line up, so 23:30 UTC is still the same day."""
    assert uk_date(datetime(2026, 12, 31, 23, 30, tzinfo=UTC)) == date(2026, 12, 31)


def test_a_booking_on_london_today_is_upcoming_but_yesterdays_is_not() -> None:
    """With London already on 1 July, a 30 June event has passed and a 1 July one has not."""
    london_today = uk_date(datetime(2026, 6, 30, 23, 30, tzinfo=UTC))
    yesterday = Booking(event_date="2026-06-30T10:00:00")
    today = Booking(event_date="2026-07-01T10:00:00")
    upcoming = dashboard.accepted_upcoming([yesterday, today], today=london_today)
    assert upcoming == [today]
    assert dashboard.pick_next_upcoming([yesterday, today], today=london_today) == today
    assert list(dashboard.bookings_by_date([yesterday, today], today=london_today)) == ["2026-07-01"]


def test_a_multi_day_event_still_running_today_stays_upcoming() -> None:
    """An event that ends today has not fully ended before today."""
    running = Booking(event_date="2026-06-29T10:00:00", event_end_date="2026-07-01T10:00:00")
    assert dashboard.accepted_upcoming([running], today=date(2026, 7, 1)) == [running]
    assert dashboard.accepted_upcoming([running], today=date(2026, 7, 2)) == []
