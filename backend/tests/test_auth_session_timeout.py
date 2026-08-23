"""Auth session checks should not treat Auth timeouts as a signed-out user."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException

from app.features.auth import messages as auth_messages
from app.features.auth.session import get_current_user_or_raise
from app.features.auth.supabase import SupabaseAuthService


def _jwt() -> str:
    return "header.payload.signature"


def test_get_user_read_timeout_is_unavailable() -> None:
    client = MagicMock()
    client.auth.get_user.side_effect = httpx.ReadTimeout("The read operation timed out")
    result = SupabaseAuthService(client).get_user_from_access_token(_jwt())
    assert result == {"success": False, "error": auth_messages.AUTH_SERVICE_UNAVAILABLE}
    client.auth.get_user.assert_called_once_with(_jwt())


def test_refresh_session_read_timeout_is_unavailable() -> None:
    client = MagicMock()
    client.auth.refresh_session.side_effect = httpx.ReadTimeout(
        "The read operation timed out",
    )
    result = SupabaseAuthService(client).refresh_session("refresh-token")
    assert result == {"success": False, "error": auth_messages.AUTH_SERVICE_UNAVAILABLE}


def test_sign_in_read_timeout_stays_unavailable_message() -> None:
    client = MagicMock()
    client.auth.sign_in_with_password.side_effect = httpx.ReadTimeout(
        "The read operation timed out",
    )
    result = SupabaseAuthService(client).sign_in_with_password(
        "user@example.com",
        "password-value",
    )
    assert result == {"success": False, "error": auth_messages.SIGN_IN_UNAVAILABLE}


@patch("app.features.auth.session.SupabaseAuthService")
@patch("app.features.auth.session.get_supabase_auth_client")
def test_get_current_user_timeout_keeps_cookies(
    _mock_client: MagicMock,
    mock_service_cls: MagicMock,
) -> None:
    mock_service_cls.return_value.get_user_from_access_token.return_value = {
        "success": False,
        "error": auth_messages.AUTH_SERVICE_UNAVAILABLE,
    }
    request = MagicMock()
    request.cookies.get.return_value = _jwt()
    response = MagicMock()

    with pytest.raises(HTTPException) as exc:
        get_current_user_or_raise(request, response)

    assert exc.value.status_code == 503
    assert exc.value.detail == auth_messages.AUTH_SERVICE_UNAVAILABLE
    response.delete_cookie.assert_not_called()


@patch("app.features.auth.session.SupabaseAuthService")
@patch("app.features.auth.session.get_supabase_auth_client")
def test_get_current_user_invalid_token_clears_cookies(
    _mock_client: MagicMock,
    mock_service_cls: MagicMock,
) -> None:
    mock_service_cls.return_value.get_user_from_access_token.return_value = {
        "success": False,
        "error": auth_messages.SIGN_IN_REQUIRED,
    }
    request = MagicMock()
    request.cookies.get.return_value = _jwt()
    response = MagicMock()

    with pytest.raises(HTTPException) as exc:
        get_current_user_or_raise(request, response)

    assert exc.value.status_code == 401
    assert exc.value.detail == auth_messages.SIGN_IN_REQUIRED
    response.delete_cookie.assert_called()
