"""Tests that GET /me applies the same guard checks as protected routes."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.contracts.auth import AuthUser
from app.contracts.auth import AuthUser
from app.features.auth.http.guards import require_user
from app.features.auth.http.routes import me


@patch("app.features.auth.http.routes.require_user")
async def test_me_delegates_to_require_user(mock_require_user):
    request = MagicMock()
    response = MagicMock()
    mock_user = AuthUser(id="u1", email="a@example.com", user_type="client")
    mock_require_user.return_value = mock_user

    result = await me(request, response)

    mock_require_user.assert_called_once_with(request, response)
    assert result.user == mock_user


@patch("app.features.auth.http.guards.bind_sentry_user")
@patch("app.features.auth.http.guards.fetch_user_profile")
@patch("app.features.auth.http.guards.build_app_user")
@patch("app.features.auth.http.guards.get_current_user_or_raise")
def test_require_user_rejects_deleted_profile(
    mock_get_user,
    mock_build,
    mock_fetch,
    _mock_sentry,
):
    mock_get_user.return_value = {"id": "u1"}
    mock_build.return_value = AuthUser(id="u1", email="a@example.com", user_type="client")
    mock_fetch.return_value = {"deleted_at": "2026-01-01T00:00:00Z"}

    request = MagicMock()
    response = MagicMock()

    with patch("app.features.auth.http.guards.profile_is_deleted", return_value=True):
        with patch("app.features.auth.http.guards.clear_session_cookies") as mock_clear:
            with pytest.raises(HTTPException) as exc:
                require_user(request, response)

    assert exc.value.status_code == 401
    mock_clear.assert_called_once_with(response)
