"""Client events — resolve/link for multi-vendor booking create."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.features.client_events import events as client_events


@patch("app.features.client_events.events.get_settings")
def test_resolve_event_creates_when_no_event_id(mock_settings):
    mock_settings.return_value.local_auth_mode = True
    eid, fields = client_events.resolve_event_for_booking(
        "client-1",
        event_id=None,
        event_name="Sarah's wedding",
        event_date=date(2026, 8, 15),
        event_address="The Barn",
        event_postcode="SW1A 1AA",
    )
    assert eid == "00000000-0000-4000-8000-000000000099"
    assert fields["event_id"] == eid
    assert fields["event_name"] == "Sarah's wedding"
    assert fields["event_date"] == "2026-08-15"
    assert fields["event_postcode"] == "SW1A 1AA"


@patch("app.features.client_events.events.get_client_event_row")
@patch("app.features.client_events.events.get_settings")
def test_resolve_event_links_existing(mock_settings, mock_get_row):
    mock_settings.return_value.local_auth_mode = False
    mock_get_row.return_value = {
        "id": "evt-1",
        "title": "Sarah's wedding",
        "event_date": "2026-08-15",
        "event_end_date": None,
        "event_address": "The Barn",
        "event_postcode": "SW1A 1AA",
        "status": "active",
    }
    eid, fields = client_events.resolve_event_for_booking(
        "client-1",
        event_id="evt-1",
        event_name="ignored",
        event_date=date(2026, 8, 15),
    )
    assert eid == "evt-1"
    assert fields["event_id"] == "evt-1"
    assert fields["event_name"] == "Sarah's wedding"
    mock_get_row.assert_called_once_with("client-1", "evt-1")


@patch("app.features.client_events.events.get_client_event_row")
@patch("app.features.client_events.events.get_settings")
def test_resolve_event_rejects_missing(mock_settings, mock_get_row):
    mock_settings.return_value.local_auth_mode = False
    mock_get_row.return_value = None
    with pytest.raises(ValueError, match="Event not found"):
        client_events.resolve_event_for_booking(
            "client-1",
            event_id="missing",
            event_name="Wedding",
            event_date=date(2026, 8, 15),
        )


@patch("app.features.client_events.events.get_client_event_row")
@patch("app.features.client_events.events.get_settings")
def test_resolve_event_rejects_archived(mock_settings, mock_get_row):
    mock_settings.return_value.local_auth_mode = False
    mock_get_row.return_value = {
        "id": "evt-1",
        "title": "Old party",
        "event_date": "2025-01-01",
        "status": "archived",
    }
    with pytest.raises(ValueError, match="archived"):
        client_events.resolve_event_for_booking(
            "client-1",
            event_id="evt-1",
            event_name="Old party",
            event_date=date(2025, 1, 1),
        )


@patch("app.features.client_events.events.get_settings")
@patch("app.features.client_events.events.get_client")
def test_create_client_event_inserts_row(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "evt-new", "title": "Engagement", "event_date": "2026-09-01"}],
    )
    created = client_events.create_client_event(
        "client-1",
        title="Engagement",
        event_date=date(2026, 9, 1),
    )
    assert created["id"] == "evt-new"
    client.table.return_value.insert.assert_called_once()
