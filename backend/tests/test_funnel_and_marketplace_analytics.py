"""Funnel first-response idempotency and marketplace analytics empty/local modes."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.features.admin.marketplace_analytics import get_marketplace_analytics
from app.features.bookings.funnel import mark_vendor_first_response, response_time_seconds


def test_response_time_seconds_non_negative():
    created = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    responded = datetime(2026, 1, 1, 12, 5, tzinfo=timezone.utc)
    assert response_time_seconds(created, responded) == 300


@patch("app.features.bookings.funnel.get_client")
def test_mark_vendor_first_response_skips_when_already_set(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[
            {
                "created_at": "2026-01-01T12:00:00+00:00",
                "vendor_first_response_at": "2026-01-01T12:01:00+00:00",
            },
        ],
    )

    mark_vendor_first_response("b1")
    # Already set — must not call update
    mock_table.update.assert_not_called()


@patch("app.features.bookings.funnel.get_client")
def test_mark_vendor_first_response_sets_once(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.is_.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.execute.return_value = MagicMock(
        data=[
            {
                "created_at": "2026-01-01T12:00:00+00:00",
                "vendor_first_response_at": None,
            },
        ],
    )

    mark_vendor_first_response(
        "b1",
        at=datetime(2026, 1, 1, 12, 10, tzinfo=timezone.utc),
    )
    mock_table.update.assert_called_once()
    patch_arg = mock_table.update.call_args[0][0]
    assert "vendor_first_response_at" in patch_arg
    assert patch_arg.get("vendor_response_time_seconds") == 600


@patch("app.features.admin.marketplace_analytics.get_settings")
def test_marketplace_analytics_empty_in_local_auth(mock_settings):
    mock_settings.return_value.local_auth_mode = True
    result = get_marketplace_analytics()
    assert result["overview"]["enquiries"] == 0
    assert result["failure_reasons"] == []
    assert result["top_vendors"] == []
