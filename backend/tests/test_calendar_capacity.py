"""Tests for maxBookingsPerDay enforcement and DB error mapping."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.features.bookings.calendar import (
    _enforce_max_bookings_per_day,
    booking_capacity_error_from_db,
    rethrow_booking_capacity_db_error,
)


def _mock_booking_rows(rows: list[dict]):
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.in_.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=rows)
    return mock_client


@patch("app.features.bookings.calendar.get_client")
@patch("app.features.bookings.calendar.get_settings")
def test_rejects_when_daily_cap_reached(mock_settings, mock_get_client):
    mock_settings.return_value.local_auth_mode = False
    mock_get_client.return_value = _mock_booking_rows(
        [
            {
                "id": "b1",
                "event_date": "2026-07-15",
                "event_end_date": None,
                "status": "accepted",
            },
            {
                "id": "b2",
                "event_date": "2026-07-15",
                "event_end_date": None,
                "status": "pending",
            },
        ],
    )
    payload = {"maxBookingsPerDay": "2"}
    with pytest.raises(ValueError, match="maximum number of bookings"):
        _enforce_max_bookings_per_day(
            "vendor-1",
            payload,
            date(2026, 7, 15),
            None,
        )


@patch("app.features.bookings.calendar.get_client")
@patch("app.features.bookings.calendar.get_settings")
def test_allows_when_under_cap(mock_settings, mock_get_client):
    mock_settings.return_value.local_auth_mode = False
    mock_get_client.return_value = _mock_booking_rows(
        [
            {
                "id": "b1",
                "event_date": "2026-07-15",
                "event_end_date": None,
                "status": "accepted",
            },
        ],
    )
    payload = {"maxBookingsPerDay": "2"}
    _enforce_max_bookings_per_day(
        "vendor-1",
        payload,
        date(2026, 7, 15),
        None,
    )


@patch("app.features.bookings.calendar.get_client")
@patch("app.features.bookings.calendar.get_settings")
def test_query_failure_is_fail_closed(mock_settings, mock_get_client):
    mock_settings.return_value.local_auth_mode = False
    mock_get_client.return_value.table.side_effect = RuntimeError("db down")
    with pytest.raises(ValueError, match="Could not verify vendor availability"):
        _enforce_max_bookings_per_day(
            "vendor-1",
            {"maxBookingsPerDay": "2"},
            date(2026, 7, 15),
            None,
        )


def test_maps_db_capacity_trigger_error():
    err = booking_capacity_error_from_db(
        Exception("vendor_daily_capacity_exceeded:2026-07-15:2"),
    )
    assert err is not None
    assert "2026-07-15" in str(err)
    assert "2" in str(err)


def test_rethrow_passes_through_other_db_errors():
    with pytest.raises(RuntimeError, match="other"):
        rethrow_booking_capacity_db_error(RuntimeError("other"))
