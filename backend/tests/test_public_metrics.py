"""Public vendor metrics fail open on PostgREST timeouts."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.features.vendors.public_metrics import (
    empty_public_vendor_metrics,
    get_public_metrics_for_vendors,
)


def _metrics_query(mock_get_db: MagicMock) -> MagicMock:
    q = MagicMock()
    mock_get_db.return_value.table.return_value = q
    q.select.return_value = q
    q.in_.return_value = q
    q.limit.return_value = q
    return q


@pytest.mark.parametrize(
    "exc",
    [
        httpx.ReadTimeout("The read operation timed out"),
        httpx.ConnectError("connection refused"),
    ],
)
@patch("app.features.vendors.public_metrics.get_db")
def test_get_public_metrics_treats_timeout_as_unavailable(
    mock_get_db: MagicMock,
    caplog: pytest.LogCaptureFixture,
    exc: Exception,
) -> None:
    q = _metrics_query(mock_get_db)
    q.execute.side_effect = exc

    with caplog.at_level("WARNING"):
        result = get_public_metrics_for_vendors(["vendor-1"])

    assert result == {"vendor-1": empty_public_vendor_metrics()}
    assert "public_vendor_metrics: load unavailable" in caplog.text
    assert "public_vendor_metrics: load failed" not in caplog.text


@patch("app.features.vendors.public_metrics.get_db")
def test_get_public_metrics_still_logs_unexpected_errors(
    mock_get_db: MagicMock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    q = _metrics_query(mock_get_db)
    q.execute.side_effect = RuntimeError("boom")

    with caplog.at_level("ERROR"):
        result = get_public_metrics_for_vendors(["vendor-1"])

    assert result == {"vendor-1": empty_public_vendor_metrics()}
    assert "public_vendor_metrics: load failed" in caplog.text
    assert "public_vendor_metrics: load unavailable" not in caplog.text


@patch("app.features.vendors.public_metrics.get_db")
def test_get_public_metrics_aggregates_booking_rows(mock_get_db: MagicMock) -> None:
    q = _metrics_query(mock_get_db)
    q.execute.return_value = MagicMock(
        data=[
            {
                "vendor_user_id": "vendor-1",
                "status": "completed",
                "initiator": "client",
                "completed_at": "2026-01-01T00:00:00+00:00",
                "vendor_response_time_seconds": 120,
            },
            {
                "vendor_user_id": "vendor-1",
                "status": "pending",
                "initiator": "client",
                "completed_at": None,
                "vendor_response_time_seconds": 60,
            },
        ],
    )

    result = get_public_metrics_for_vendors(["vendor-1"])
    assert result["vendor-1"]["completed_bookings"] == 1
    assert result["vendor-1"]["avg_response_seconds"] == 90.0
    assert result["vendor-1"]["conversion_rate"] == 0.5
