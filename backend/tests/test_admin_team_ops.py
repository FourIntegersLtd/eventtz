"""Tests for admin team operations."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.admin import team_ops


@patch("app.features.admin.team_ops.get_settings")
def test_list_admin_team_empty_in_local_mode(mock_settings) -> None:
    mock_settings.return_value.local_auth_mode = True
    assert team_ops.list_admin_team() == []


@patch("app.features.admin.team_ops.fetch_user_profile")
@patch("app.features.admin.team_ops.is_super_admin_user", return_value=True)
@patch("app.features.admin.team_ops.get_settings")
def test_delete_admin_team_member_blocks_self(mock_settings, _mock_super, mock_fetch) -> None:
    mock_settings.return_value.local_auth_mode = False
    mock_fetch.side_effect = [
        {"id": "actor-1", "user_type": "admin", "email": "a@test.com", "admin_role": "super_admin"},
        {"id": "actor-1", "user_type": "admin", "email": "a@test.com", "admin_role": "super_admin"},
    ]
    with pytest.raises(ValueError, match="cannot delete yourself"):
        team_ops.delete_admin_team_member("actor-1", actor_user_id="actor-1")


@patch("app.features.admin.team_ops.request_password_reset")
@patch("app.features.admin.team_ops.fetch_user_profile_by_email")
@patch("app.features.admin.team_ops.get_settings")
def test_send_admin_password_reset_link(mock_settings, mock_by_email, mock_reset) -> None:
    mock_settings.return_value.local_auth_mode = False
    mock_by_email.return_value = None
    with patch("app.features.admin.team_ops.fetch_user_profile") as mock_fetch:
        mock_fetch.side_effect = [
            {"id": "actor-1", "user_type": "admin", "email": "super@test.com", "admin_role": "super_admin"},
            {"id": "user-2", "user_type": "admin", "email": "admin@test.com", "admin_role": "admin"},
        ]
        with patch("app.features.admin.team_ops.is_super_admin_user", return_value=True):
            result = team_ops.send_admin_password_reset_link("user-2", actor_user_id="actor-1")
    assert result["email"] == "admin@test.com"
    mock_reset.assert_called_once_with(email="admin@test.com", client_ip=None)


@patch("app.features.admin.team_ops.get_client")
@patch("app.features.admin.team_ops.fetch_user_profile_by_email", return_value=None)
@patch("app.features.admin.team_ops.get_settings")
def test_invite_admin_colleague_with_invite_link(mock_settings, _mock_email, mock_client) -> None:
    mock_settings.return_value.local_auth_mode = False
    created_user = MagicMock()
    created_user.id = "new-admin-id"
    mock_client.return_value.auth.admin.create_user.return_value = MagicMock(user=created_user)
    mock_client.return_value.table.return_value.upsert.return_value.execute.return_value = MagicMock()

    with patch("app.features.admin.team_ops.request_password_reset") as mock_reset:
        with patch("app.features.admin.team_ops.send_admin_welcome_email") as mock_welcome:
            result = team_ops.invite_admin_colleague("newadmin@test.com", password=None)

    assert result["created"] is True
    assert result["invite_link_sent"] is True
    mock_reset.assert_called_once_with(email="newadmin@test.com", client_ip=None, purpose="setup")
    mock_welcome.assert_not_called()


@patch("app.features.admin.team_ops._hard_delete_admin_user")
@patch("app.features.admin.team_ops._has_client_activity", return_value=False)
@patch("app.features.admin.team_ops._has_vendor_profile", return_value=False)
@patch("app.features.admin.team_ops.fetch_user_profile")
@patch("app.features.admin.team_ops.is_super_admin_user", return_value=True)
@patch("app.features.admin.team_ops.get_settings")
def test_delete_admin_team_member_hard_delete(
    mock_settings,
    _mock_super,
    mock_fetch,
    _mock_vendor,
    _mock_client,
    mock_hard_delete,
) -> None:
    mock_settings.return_value.local_auth_mode = False
    mock_fetch.side_effect = [
        {"id": "actor-1", "user_type": "admin", "email": "super@test.com", "admin_role": "super_admin"},
        {"id": "user-2", "user_type": "admin", "email": "admin@test.com", "admin_role": "admin"},
    ]
    with patch.object(team_ops.get_client(), "table") as mock_table:
        mock_table.return_value.select.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(
            count=1,
        )
        result = team_ops.delete_admin_team_member("user-2", actor_user_id="actor-1")
    assert result["deleted"] is True
    assert result["demoted_to"] is None
    mock_hard_delete.assert_called_once_with("user-2")


@patch("app.features.admin.team_ops.invalidate_all_sessions")
@patch("app.features.admin.team_ops.get_client")
def test_hard_delete_admin_user_purges_blockers(mock_get_client, _mock_invalidate) -> None:
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.delete.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])

    team_ops._hard_delete_admin_user("user-2")

    table_names = [c[0][0] for c in mock_client.table.call_args_list]
    assert table_names == ["admin_audit_log", "contact_submissions", "users"]
    mock_client.auth.admin.delete_user.assert_called_once_with("user-2")
