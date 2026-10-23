"""Every business date uses the London calendar day: 23:30 UTC on a summer day is already tomorrow there."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from app.core.time import uk_day_key
from app.features.admin_insights import domain as insights_domain
from app.features.bookings.domain_maintenance import tomorrow_uk
from app.features.bookings.errors import DateChangeInPast
from app.features.bookings.schemas import _check_event_dates
from app.features.bookings.service_admin_financials import _daily_window
from app.features.bookings.service_date_change import _check_new_dates
from app.features.marketplace.service_analytics import period_start
from app.features.vendors.rows import ListedVendorRow, VendorRow
from app.features.vendors.service_listing import INSURANCE_CHECKED_UNTIL_KEY, _listed
from app.features.vendors.service_profile import insurance_state

#: 30 June 2026 23:30 UTC is 00:30 BST on 1 July in London.
JUST_PAST_LONDON_MIDNIGHT = datetime(2026, 6, 30, 23, 30, tzinfo=UTC)
#: 30 June 2026 22:59 UTC is 23:59 BST, still 30 June in London.
JUST_BEFORE_LONDON_MIDNIGHT = datetime(2026, 6, 30, 22, 59, tzinfo=UTC)


def test_listing_drops_the_badge_once_the_london_day_after_expiry_begins() -> None:
    """Cover ending 30 June still shows its badge until London midnight, not UTC midnight."""
    row = ListedVendorRow(user_id="v", insurance_expires_on=date(2026, 6, 30))
    before = _listed([row], now=JUST_BEFORE_LONDON_MIDNIGHT)[0]
    after = _listed([row], now=JUST_PAST_LONDON_MIDNIGHT)[0]
    assert before.payload[INSURANCE_CHECKED_UNTIL_KEY] == "2026-06-30"
    assert INSURANCE_CHECKED_UNTIL_KEY not in after.payload


def test_staff_insurance_state_turns_expired_at_london_midnight() -> None:
    """The staff view reads 30 June cover as expired at 00:30 BST on 1 July."""
    vendor = VendorRow(user_id="v", insurance_expires_on=date(2026, 6, 30))
    assert insurance_state(vendor, now=JUST_BEFORE_LONDON_MIDNIGHT).status == "expiring"
    assert insurance_state(vendor, now=JUST_PAST_LONDON_MIDNIGHT).status == "expired"


def test_the_financials_default_window_ends_on_the_london_day() -> None:
    """With no dates given, the daily table ends on 1 July and starts 29 days earlier."""
    assert _daily_window(None, None, JUST_PAST_LONDON_MIDNIGHT) == (date(2026, 6, 2), date(2026, 7, 1))
    assert _daily_window(None, None, JUST_BEFORE_LONDON_MIDNIGHT) == (date(2026, 6, 1), date(2026, 6, 30))


def test_the_vendor_analytics_window_opens_at_london_midnight() -> None:
    """A 7-day window counting 1 July opens at 00:00 BST on 25 June (23:00 UTC on 24 June)."""
    today, since = period_start(7, JUST_PAST_LONDON_MIDNIGHT)
    assert today == date(2026, 7, 1)
    assert since.astimezone(UTC) == datetime(2026, 6, 24, 23, 0, tzinfo=UTC)


def test_the_admin_charts_end_on_the_london_day() -> None:
    """The dashboard chart's last day is 1 July at 00:30 BST."""
    assert insights_domain.date_range(3, JUST_PAST_LONDON_MIDNIGHT) == [
        "2026-06-29",
        "2026-06-30",
        "2026-07-01",
    ]
    assert insights_domain.date_range(3, JUST_BEFORE_LONDON_MIDNIGHT)[-1] == "2026-06-30"


def test_an_event_is_over_once_its_last_london_day_has_finished() -> None:
    """An event on 30 June counts as over at 00:30 BST on 1 July."""
    row = {"event_date": "2026-06-30"}
    assert insights_domain._event_is_over(row, JUST_BEFORE_LONDON_MIDNIGHT) is False
    assert insights_domain._event_is_over(row, JUST_PAST_LONDON_MIDNIGHT) is True


def test_a_booking_for_today_in_london_is_not_in_the_past() -> None:
    """At 00:30 BST on 1 July, 30 June is the past and 1 July is allowed."""
    _check_event_dates(date(2026, 7, 1), None, JUST_PAST_LONDON_MIDNIGHT)
    with pytest.raises(ValueError, match="past"):
        _check_event_dates(date(2026, 6, 30), None, JUST_PAST_LONDON_MIDNIGHT)
    _check_event_dates(date(2026, 6, 30), None, JUST_BEFORE_LONDON_MIDNIGHT)


def test_a_date_change_to_today_in_london_is_allowed() -> None:
    """The same boundary for a proposed new date."""
    _check_new_dates(date(2026, 7, 1), None, JUST_PAST_LONDON_MIDNIGHT)
    with pytest.raises(DateChangeInPast):
        _check_new_dates(date(2026, 6, 30), None, JUST_PAST_LONDON_MIDNIGHT)


def test_event_tomorrow_reminders_look_at_the_london_tomorrow() -> None:
    """At 00:30 BST on 1 July, tomorrow is 2 July (UTC would still say 1 July)."""
    assert tomorrow_uk(JUST_PAST_LONDON_MIDNIGHT) == date(2026, 7, 2)
    assert tomorrow_uk(JUST_BEFORE_LONDON_MIDNIGHT) == date(2026, 7, 1)


def test_paid_and_created_bookings_bucket_on_the_london_day() -> None:
    """A booking paid and created at 23:30 UTC on 30 June counts under 1 July."""
    days = ["2026-06-30", "2026-07-01"]
    row = {"paid_at": "2026-06-30T23:30:00+00:00", "created_at": "2026-06-30T23:30:00Z", "gmv_gbp": 120.0}
    paid = insights_domain.build_booking_paid_buckets(days, [row])
    created = insights_domain.build_booking_created_buckets(days, [row])
    assert [(bucket["date"], bucket["count"], bucket["gmv_gbp"]) for bucket in paid] == [
        ("2026-06-30", 0, 0.0),
        ("2026-07-01", 1, 120.0),
    ]
    assert [bucket["count"] for bucket in created] == [0, 1]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2026-06-30T23:30:00+00:00", "2026-07-01"),
        ("2026-06-30T23:30:00Z", "2026-07-01"),
        ("2026-06-30 23:30:00+00:00", "2026-07-01"),
        ("2026-06-30T23:30:00", "2026-07-01"),
        ("2026-06-30T22:59:00+00:00", "2026-06-30"),
        ("2026-01-15T23:30:00+00:00", "2026-01-15"),
        ("2026-06-30", "2026-06-30"),
        ("garbage", None),
        ("", None),
        (None, None),
    ],
)
def test_uk_day_key_reads_every_timestamp_shape_as_a_london_day(
    raw: str | None, expected: str | None
) -> None:
    """Offsets, Z, a space separator, naive (read as UTC), a bare date, and unreadable input."""
    assert uk_day_key(raw) == expected


def test_months_roll_over_on_the_london_day() -> None:
    """An enquiry created 23:30 UTC on 30 June belongs to July."""
    assert insights_domain.month_key("2026-06-30T23:30:00+00:00") == "2026-07"


def test_a_day_bound_is_london_midnight_across_clock_changes() -> None:
    """The day the clocks go forward is 23 hours long, the day they go back 25, in UTC instants."""
    from app.features.admin_insights.repository import _day_bounds

    assert _day_bounds("2026-03-29") == (
        datetime(2026, 3, 29, 0, 0, tzinfo=UTC),
        datetime(2026, 3, 29, 23, 0, tzinfo=UTC),
    )
    assert _day_bounds("2026-10-25") == (
        datetime(2026, 10, 24, 23, 0, tzinfo=UTC),
        datetime(2026, 10, 26, 0, 0, tzinfo=UTC),
    )
