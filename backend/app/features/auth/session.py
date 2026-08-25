"""Session cookies and checking sign-in tokens (Supabase)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request, Response

from app.core.config import get_settings
from app.core.constants import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from app.features.auth import messages as auth_messages
from app.features.auth.supabase import SupabaseAuthService
from app.core.db import get_supabase_auth_client


def cookie_settings() -> dict[str, Any]:
    settings = get_settings()
    # Cross-site SPA (e.g. localhost → Railway): SameSite=None + Secure required.
    # Same-site local dev (localhost:3000 → localhost:8000) works with Lax + non-secure.
    if settings.is_production:
        return {
            "httponly": True,
            "secure": True,
            "samesite": "none",
            "path": "/",
        }
    return {
        "httponly": True,
        "secure": False,
        "samesite": "lax",
        "path": "/",
    }


def set_session_cookies(response: Response, session: dict[str, Any]) -> None:
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        session["access_token"],
        max_age=60 * 60,
        **cookie_settings(),
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        session["refresh_token"],
        max_age=60 * 60 * 24 * 14,
        **cookie_settings(),
    )


def clear_session_cookies(response: Response) -> None:
    opts = cookie_settings()
    response.delete_cookie(
        ACCESS_COOKIE_NAME,
        path="/",
        secure=opts.get("secure", False),
        samesite=opts.get("samesite", "lax"),
    )
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/",
        secure=opts.get("secure", False),
        samesite=opts.get("samesite", "lax"),
    )


def _looks_like_jwt(token: str) -> bool:
    return token.count(".") == 2 and " " not in token


def get_current_user_or_raise(request: Request, response: Response) -> dict[str, Any]:
    """Validate session cookie and return the Supabase auth user (before merging public.users)."""
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not access_token:
        raise HTTPException(status_code=401, detail=auth_messages.SIGN_IN_REQUIRED)

    if not _looks_like_jwt(access_token):
        clear_session_cookies(response)
        raise HTTPException(
            status_code=401,
            detail=auth_messages.SESSION_EXPIRED,
        )

    service = SupabaseAuthService(get_supabase_auth_client())
    result = service.get_user_from_access_token(access_token)
    if result.get("success"):
        return result["user"]
    if result.get("unavailable"):
        raise HTTPException(
            status_code=503,
            detail=result.get("error", auth_messages.AUTH_SERVICE_UNAVAILABLE),
        )
    clear_session_cookies(response)
    raise HTTPException(status_code=401, detail=result.get("error", auth_messages.SIGN_IN_REQUIRED))
