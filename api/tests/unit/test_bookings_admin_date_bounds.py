"""The admin console's `date_from`/`date_to` strings become UTC timestamps before they reach a query."""

from __future__ import annotations

from datetime import UTC, datetime

from app.features.bookings.repository_admin import _as_datetime_bound


def test_a_plain_date_means_midnight_utc() -> None:
    assert _as_datetime_bound("2030-01-31") == datetime(2030, 1, 31, tzinfo=UTC)


def test_a_timestamp_without_an_offset_is_read_as_utc() -> None:
    assert _as_datetime_bound("2030-01-31T09:30:00") == datetime(2030, 1, 31, 9, 30, tzinfo=UTC)


def test_a_timestamp_with_an_offset_is_converted_to_utc() -> None:
    assert _as_datetime_bound("2030-06-01T10:00:00+01:00") == datetime(2030, 6, 1, 9, 0, tzinfo=UTC)
