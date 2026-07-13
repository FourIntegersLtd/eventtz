"""Client display-name lookup and onboarding state service."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.features.auth.lookup import _friendly_name_from_email
from app.features.settings.client_onboarding import (
    get_client_onboarding,
    update_client_onboarding,
)


def test_friendly_name_from_email():
    assert _friendly_name_from_email("jane.doe@example.com") == "Jane Doe"
    assert _friendly_name_from_email("kenny_92@example.com") == "Kenny"
    assert _friendly_name_from_email("bob@example.com") == "Bob"
    assert _friendly_name_from_email(None) is None
    assert _friendly_name_from_email("not-an-email") is None


def _mock_users_table(mock_get_client, row):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.limit.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[row] if row else [])
    return mock_table


@patch("app.features.settings.client_onboarding.get_settings")
@patch("app.features.settings.client_onboarding.get_client")
def test_onboarding_state_completed_when_timestamp_set(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    _mock_users_table(
        mock_get_client,
        {"preferred_name": "Kenny", "client_onboarding_completed_at": "2026-07-13T00:00:00Z"},
    )
    state = get_client_onboarding("c1")
    assert state == {"completed": True, "preferred_name": "Kenny"}


@patch("app.features.settings.client_onboarding.get_settings")
@patch("app.features.settings.client_onboarding.get_client")
def test_onboarding_state_incomplete_by_default(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    _mock_users_table(
        mock_get_client,
        {"preferred_name": None, "client_onboarding_completed_at": None},
    )
    state = get_client_onboarding("c1")
    assert state == {"completed": False, "preferred_name": None}


@patch("app.features.settings.client_onboarding.get_settings")
@patch("app.features.settings.client_onboarding.get_client")
def test_update_marks_completed_and_saves_name(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    table = _mock_users_table(
        mock_get_client,
        {"preferred_name": "Kenny", "client_onboarding_completed_at": "2026-07-13T00:00:00Z"},
    )
    update_client_onboarding("c1", preferred_name="  Kenny  ", mark_completed=True)
    patch_arg = table.update.call_args[0][0]
    assert patch_arg["preferred_name"] == "Kenny"
    assert patch_arg["client_onboarding_completed_at"]
