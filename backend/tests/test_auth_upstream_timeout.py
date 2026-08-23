"""GoTrue timeouts must not be treated as an expired session (EVENTTZ-BACKEND-G)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException, Response

from app.core.constants import ACCESS_COOKIE_NAME
from app.features.auth import messages as auth_messages
from app.features.auth.session import get_current_user_or_raise, raise_failed_auth
from app.features.auth.supabase import SupabaseAuthService, is_upstream_unavailable


def test_refresh_session_timeout_is_upstream_unavailable() -> None:
    client = MagicMock()
    client.auth.refresh_session.side_effect = httpx.ReadTimeout("The read operation timed out")
    result = SupabaseAuthService(client).refresh_session("refresh-token")
    assert result["success"] is False
    assert is_upstream_unavailable(result)
    assert result["error"] == auth_messages.AUTH_UPSTREAM_UNAVAILABLE


def test_get_user_timeout_is_upstream_unavailable() -> None:
    client = MagicMock()
    client.auth.get_user.side_effect = httpx.ConnectError("connection refused")
    result = SupabaseAuthService(client).get_user_from_access_token("access-token")
    assert result["success"] is False
    assert is_upstream_unavailable(result)


def test_refresh_session_timeout_logs_warning_not_exception() -> None:
    client = MagicMock()
    client.auth.refresh_session.side_effect = httpx.ReadTimeout("The read operation timed out")
    with patch("app.features.auth.supabase.logger") as logger:
        SupabaseAuthService(client).refresh_session("refresh-token")
    logger.exception.assert_not_called()
    logger.warning.assert_called()


def test_refresh_session_auth_api_error_still_expired() -> None:
    from supabase_auth.errors import AuthApiError

    client = MagicMock()
    client.auth.refresh_session.side_effect = AuthApiError("Invalid Refresh Token", 401, "invalid_grant")
    result = SupabaseAuthService(client).refresh_session("stale")
    assert result["success"] is False
    assert not is_upstream_unavailable(result)
    assert result["error"] == auth_messages.REFRESH_SESSION_EXPIRED


def test_raise_failed_auth_keeps_cookies_on_upstream_timeout() -> None:
    response = Response()
    result = {
        "success": False,
        "error": auth_messages.AUTH_UPSTREAM_UNAVAILABLE,
        "code": "auth_upstream_unavailable",
    }
    with pytest.raises(HTTPException) as exc:
        raise_failed_auth(response, result, fallback=auth_messages.REFRESH_SESSION_EXPIRED)
    assert exc.value.status_code == 503
    assert exc.value.detail == auth_messages.AUTH_UPSTREAM_UNAVAILABLE
    assert not any(k.lower() == "set-cookie" for k in response.headers.keys())


def test_raise_failed_auth_clears_cookies_when_session_expired() -> None:
    response = Response()
    result = {"success": False, "error": auth_messages.REFRESH_SESSION_EXPIRED}
    with pytest.raises(HTTPException) as exc:
        raise_failed_auth(response, result, fallback=auth_messages.REFRESH_SESSION_EXPIRED)
    assert exc.value.status_code == 401
    assert any(k.lower() == "set-cookie" for k in response.headers.keys())


@patch("app.features.auth.session.get_supabase_auth_client")
@patch("app.features.auth.session.SupabaseAuthService")
def test_get_current_user_keeps_session_on_gotrue_timeout(
    mock_service_cls: MagicMock,
    _mock_client: MagicMock,
) -> None:
    mock_service_cls.return_value.get_user_from_access_token.return_value = {
        "success": False,
        "error": auth_messages.AUTH_UPSTREAM_UNAVAILABLE,
        "code": "auth_upstream_unavailable",
    }
    request = MagicMock()
    request.cookies.get.return_value = "header.payload.sig"
    response = Response()
    with pytest.raises(HTTPException) as exc:
        get_current_user_or_raise(request, response)
    request.cookies.get.assert_called_with(ACCESS_COOKIE_NAME)
    assert exc.value.status_code == 503
    assert not any(k.lower() == "set-cookie" for k in response.headers.keys())
