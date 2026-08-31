"""GoTrue read timeouts are transient (503), not expired sessions."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException

from httpx import ASGITransport, AsyncClient

from app.core.constants import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from app.core.errors import ServiceUnavailableError
from app.features.auth import messages as auth_messages
from app.features.auth.password_reset import change_password
from app.features.auth.session import get_current_user_or_raise
from app.features.auth.supabase import SupabaseAuthService
from app.features.settings.account_deletion_gates import assert_password
from app.main import app


def _timeout_client(**method_errors: BaseException) -> MagicMock:
    client = MagicMock()
    for name, exc in method_errors.items():
        getattr(client.auth, name).side_effect = exc
    return client


def test_sign_in_read_timeout_is_unavailable() -> None:
    service = SupabaseAuthService(
        _timeout_client(sign_in_with_password=httpx.ReadTimeout("timed out")),
    )
    result = service.sign_in_with_password("user@example.com", "secret")
    assert result == {
        "success": False,
        "error": auth_messages.SIGN_IN_UNAVAILABLE,
        "unavailable": True,
    }


def test_refresh_read_timeout_is_unavailable() -> None:
    service = SupabaseAuthService(
        _timeout_client(refresh_session=httpx.ReadTimeout("timed out")),
    )
    result = service.refresh_session("refresh-token")
    assert result["unavailable"] is True
    assert result["error"] == auth_messages.AUTH_SERVICE_UNAVAILABLE
    assert result["success"] is False


def test_get_user_read_timeout_is_unavailable() -> None:
    service = SupabaseAuthService(
        _timeout_client(get_user=httpx.ReadTimeout("timed out")),
    )
    result = service.get_user_from_access_token("access-token")
    assert result["unavailable"] is True
    assert result["error"] == auth_messages.AUTH_SERVICE_UNAVAILABLE


def test_get_user_connect_error_is_unavailable() -> None:
    service = SupabaseAuthService(
        _timeout_client(get_user=httpx.ConnectError("connection refused")),
    )
    result = service.get_user_from_access_token("access-token")
    assert result.get("unavailable") is True


def test_get_user_invalid_token_is_not_unavailable() -> None:
    from supabase_auth.errors import AuthApiError

    err = AuthApiError("invalid JWT", 401, "invalid_token")
    service = SupabaseAuthService(_timeout_client(get_user=err))
    result = service.get_user_from_access_token("access-token")
    assert result == {"success": False, "error": auth_messages.SIGN_IN_REQUIRED}


def test_session_timeout_keeps_cookies_and_returns_503() -> None:
    request = MagicMock()
    request.cookies.get.return_value = "aaa.bbb.ccc"
    response = MagicMock()
    with (
        patch("app.features.auth.session.get_supabase_auth_client"),
        patch("app.features.auth.session.SupabaseAuthService") as service_cls,
    ):
        service_cls.return_value.get_user_from_access_token.return_value = {
            "success": False,
            "error": auth_messages.AUTH_SERVICE_UNAVAILABLE,
            "unavailable": True,
        }
        with pytest.raises(HTTPException) as exc:
            get_current_user_or_raise(request, response)
    assert exc.value.status_code == 503
    assert exc.value.detail == auth_messages.AUTH_SERVICE_UNAVAILABLE
    response.delete_cookie.assert_not_called()
    request.cookies.get.assert_called_once_with(ACCESS_COOKIE_NAME)


def test_session_invalid_token_still_clears_cookies() -> None:
    request = MagicMock()
    request.cookies.get.return_value = "aaa.bbb.ccc"
    response = MagicMock()
    with (
        patch("app.features.auth.session.get_supabase_auth_client"),
        patch("app.features.auth.session.SupabaseAuthService") as service_cls,
    ):
        service_cls.return_value.get_user_from_access_token.return_value = {
            "success": False,
            "error": auth_messages.SIGN_IN_REQUIRED,
        }
        with pytest.raises(HTTPException) as exc:
            get_current_user_or_raise(request, response)
    assert exc.value.status_code == 401
    assert exc.value.detail == auth_messages.SIGN_IN_REQUIRED
    assert response.delete_cookie.called


@patch("app.features.auth.password_reset.send_password_changed_email")
@patch("app.features.auth.password_reset.invalidate_all_sessions")
@patch("app.features.auth.password_reset._log_password_audit")
@patch("app.features.auth.password_reset._user_type_for_id", return_value="admin")
@patch("app.features.auth.password_reset.validate_password_for_user")
@patch("app.features.auth.rate_limit.assert_change_password_rate")
@patch("app.features.auth.password_reset.SupabaseAuthService")
def test_change_password_timeout_is_not_wrong_password(
    mock_auth_service_cls: MagicMock,
    _mock_rate: MagicMock,
    _mock_validate: MagicMock,
    _mock_user_type: MagicMock,
    _mock_audit: MagicMock,
    _mock_invalidate: MagicMock,
    _mock_email: MagicMock,
) -> None:
    mock_auth_service_cls.return_value.sign_in_with_password.return_value = {
        "success": False,
        "error": auth_messages.SIGN_IN_UNAVAILABLE,
        "unavailable": True,
    }
    with pytest.raises(ValueError, match=auth_messages.AUTH_SERVICE_UNAVAILABLE):
        change_password(
            user_id="user-abc",
            email="admin@test.com",
            current_password="OldPassword1!",
            new_password="NewPassword2!",
        )
    _mock_invalidate.assert_not_called()


async def test_signin_route_timeout_returns_503() -> None:
    service = MagicMock()
    service.sign_in_with_password.return_value = {
        "success": False,
        "error": auth_messages.SIGN_IN_UNAVAILABLE,
        "unavailable": True,
    }
    transport = ASGITransport(app=app)
    with patch(
        "app.features.auth.http.routes.get_supabase_auth_service",
        return_value=service,
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/signin",
                json={"email": "user@example.com", "password": "secret"},
            )
    assert response.status_code == 503
    assert response.json()["detail"] == auth_messages.SIGN_IN_UNAVAILABLE
    assert "set-cookie" not in {k.lower() for k in response.headers}


async def test_refresh_route_timeout_keeps_cookies() -> None:
    service = MagicMock()
    service.refresh_session.return_value = {
        "success": False,
        "error": auth_messages.AUTH_SERVICE_UNAVAILABLE,
        "unavailable": True,
    }
    transport = ASGITransport(app=app)
    with patch(
        "app.features.auth.http.routes.get_supabase_auth_service",
        return_value=service,
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            client.cookies.set(REFRESH_COOKIE_NAME, "refresh-token")
            response = await client.post("/api/v1/auth/refresh", json={})
    assert response.status_code == 503
    assert response.json()["detail"] == auth_messages.AUTH_SERVICE_UNAVAILABLE
    set_cookie = response.headers.get("set-cookie", "")
    assert REFRESH_COOKIE_NAME not in set_cookie
    assert ACCESS_COOKIE_NAME not in set_cookie


def test_account_deletion_timeout_is_unavailable() -> None:
    with patch(
        "app.features.settings.account_deletion_gates.SupabaseAuthService",
    ) as service_cls:
        service_cls.return_value.sign_in_with_password.return_value = {
            "success": False,
            "error": auth_messages.SIGN_IN_UNAVAILABLE,
            "unavailable": True,
        }
        with pytest.raises(ServiceUnavailableError, match=auth_messages.AUTH_SERVICE_UNAVAILABLE):
            assert_password("user@example.com", "secret")
