"""Every business date uses the London calendar day: 23:30 UTC on a summer day is already tomorrow there."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from app.features.admin_insights import domain as insights_domain
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
