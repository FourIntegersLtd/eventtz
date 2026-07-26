"""Password reset email copy and public URL behaviour."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.auth.password_reset import _reset_url, _set_supabase_password, change_password
from app.features.email.branding import ensure_public_email_url, public_email_url
from app.features.email.service import EmailService


def test_set_supabase_password_uses_service_client() -> None:
    mock_client = MagicMock()
    with patch("app.features.auth.password_reset.get_client", return_value=mock_client):
        _set_supabase_password("user-abc", "NewPassword1!")
    mock_client.auth.admin.update_user_by_id.assert_called_once_with(
        "user-abc",
        {"password": "NewPassword1!"},
    )


@patch("app.features.auth.password_reset.send_password_changed_email")
@patch("app.features.auth.password_reset.invalidate_all_sessions")
@patch("app.features.auth.password_reset._log_password_audit")
@patch("app.features.auth.password_reset._user_type_for_id", return_value="admin")
@patch("app.features.auth.password_reset.validate_password_for_user")
@patch("app.features.auth.rate_limit.assert_change_password_rate")
@patch("app.features.auth.password_reset.local_auth_store.enabled", return_value=False)
@patch("app.features.auth.password_reset.SupabaseAuthService")
@patch("app.features.auth.password_reset.get_client")
def test_change_password_uses_service_client_for_supabase_update(
    mock_get_client: MagicMock,
    mock_auth_service_cls: MagicMock,
    _mock_local: MagicMock,
    _mock_rate: MagicMock,
    _mock_validate: MagicMock,
    _mock_user_type: MagicMock,
    _mock_audit: MagicMock,
    _mock_invalidate: MagicMock,
    _mock_email: MagicMock,
) -> None:
    mock_service = MagicMock()
    mock_auth_service_cls.return_value = mock_service
    mock_service.sign_in_with_password.return_value = {"success": True}
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client

    change_password(
        user_id="user-abc",
        email="admin@test.com",
        current_password="OldPassword1!",
        new_password="NewPassword2!",
    )

    mock_service.sign_in_with_password.assert_called_once_with(
        email="admin@test.com",
        password="OldPassword1!",
    )
    mock_client.auth.admin.update_user_by_id.assert_called_once_with(
        "user-abc",
        {"password": "NewPassword2!"},
    )


@patch("app.features.auth.password_reset.local_auth_store.enabled", return_value=False)
@patch("app.features.auth.password_reset.SupabaseAuthService")
def test_change_password_rejects_wrong_current_password(
    mock_auth_service_cls: MagicMock,
    _mock_local: MagicMock,
) -> None:
    mock_service = MagicMock()
    mock_auth_service_cls.return_value = mock_service
    mock_service.sign_in_with_password.return_value = {"success": False}

    with pytest.raises(ValueError, match="Current password is incorrect"):
        change_password(
            user_id="user-abc",
            email="admin@test.com",
            current_password="WrongPassword1!",
            new_password="NewPassword2!",
        )


def test_reset_url_uses_public_website() -> None:
    url = _reset_url("test-token-value-here", user_type="admin")
    assert url.startswith("https://www.eventtz.com/reset-password?portal=admin&token=")
    assert "localhost" not in url


def test_public_email_url_builds_admin_login() -> None:
    assert public_email_url("/admin/login") == "https://www.eventtz.com/admin/login"


def test_ensure_public_email_url_rewrites_localhost() -> None:
    rewritten = ensure_public_email_url(
        "http://localhost:3000/admin/reset-password?token=abc123",
    )
    assert rewritten == "https://www.eventtz.com/admin/reset-password?token=abc123"


def test_ensure_public_email_url_normalizes_apex() -> None:
    rewritten = ensure_public_email_url(
        "https://eventtz.com/reset-password?portal=admin&token=abc123",
    )
    assert rewritten == "https://www.eventtz.com/reset-password?portal=admin&token=abc123"


def test_send_password_reset_admin_setup_copy() -> None:
    svc = EmailService()
    with patch("app.features.email.service.resend_send", return_value=True) as mock_send:
        ok = svc.send_password_reset(
            to_email="admin@test.com",
            reset_url="https://www.eventtz.com/reset-password?portal=admin&token=abc",
            user_type="admin",
            purpose="setup",
        )
    assert ok is True
    _, kwargs = mock_send.call_args
    assert "Welcome to the admin team" in kwargs["subject"]
    assert "reset-password?portal=admin" in kwargs["html"]
    assert "token=abc" in kwargs["html"]
    assert "Set up password" in kwargs["html"]
    assert "localhost" not in kwargs["html"]


def test_send_password_reset_admin_reset_copy() -> None:
    svc = EmailService()
    with patch("app.features.email.service.resend_send", return_value=True) as mock_send:
        ok = svc.send_password_reset(
            to_email="admin@test.com",
            reset_url="https://eventtz.com/admin/reset-password?token=abc",
            user_type="admin",
            purpose="reset",
        )
    assert ok is True
    _, kwargs = mock_send.call_args
    assert "Reset your admin password" in kwargs["subject"]
    assert "Reset password" in kwargs["html"]
