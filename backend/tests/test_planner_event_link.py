"""Planner → client_events link."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import NotFoundError
from app.features.planner import event_link


@patch("app.features.planner.event_link.client_events_ops.create_client_event")
@patch("app.features.planner.event_link.client_events_ops.get_client_event_row")
@patch("app.features.planner.event_link.client_events_ops.booking_counts_by_event", return_value={})
@patch("app.features.planner.event_link.planner_db.get_plan_for_client")
@patch("app.features.planner.event_link.get_settings")
@patch("app.features.planner.event_link.get_db")
def test_ensure_creates_event_when_plan_has_none(
    mock_get_db,
    mock_settings,
    mock_get_plan,
    _counts,
    mock_get_row,
    mock_create,
):
    mock_settings.return_value.local_auth_mode = False
    mock_get_plan.return_value = {
        "id": "plan-1",
        "status": "active",
        "title": "Sarah's wedding",
        "brief": {"location": "London", "preferred_date": "2026-08-15", "preferred_date_invalid": False},
        "client_event_id": None,
    }
    mock_create.return_value = {
        "id": "evt-new",
        "title": "Sarah's wedding",
        "event_date": "2026-08-15",
        "event_address": "London",
        "status": "active",
    }
    client = MagicMock()
    mock_get_db.return_value = client

    summary = event_link.ensure_client_event_for_plan("client-1", "plan-1")

    assert summary["id"] == "evt-new"
    mock_create.assert_called_once()
    client.table.return_value.update.assert_called_once()


@patch("app.features.planner.event_link.client_events_ops.event_row_to_summary")
@patch("app.features.planner.event_link.client_events_ops.booking_counts_by_event", return_value={})
@patch("app.features.planner.event_link.client_events_ops.get_client_event_row")
@patch("app.features.planner.event_link.planner_db.get_plan_for_client")
@patch("app.features.planner.event_link.get_settings")
def test_ensure_reuses_existing_linked_event(
    mock_settings,
    mock_get_plan,
    mock_get_row,
    _counts,
    mock_to_summary,
):
    mock_settings.return_value.local_auth_mode = False
    mock_get_plan.return_value = {
        "id": "plan-1",
        "status": "active",
        "title": "Party",
        "brief": {},
        "client_event_id": "evt-existing",
    }
    mock_get_row.return_value = {
        "id": "evt-existing",
        "title": "Party",
        "status": "active",
    }
    mock_to_summary.return_value = {"id": "evt-existing", "title": "Party"}

    summary = event_link.ensure_client_event_for_plan("client-1", "plan-1")

    assert summary["id"] == "evt-existing"
    mock_to_summary.assert_called_once()


@patch("app.features.planner.event_link.planner_db.get_plan_for_client")
def test_ensure_plan_not_found(mock_get_plan):
    mock_get_plan.return_value = None
    with pytest.raises(NotFoundError):
        event_link.ensure_client_event_for_plan("client-1", "missing")
