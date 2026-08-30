"""Checks that the caller is signed in and has the right account type."""

from __future__ import annotations

from fastapi import HTTPException, Request, Response

from app.contracts.auth import AuthUser
from app.contracts.types import UserType
from app.core.logging import get_logger
from app.core.sentry import bind_sentry_user
from app.features.auth import messages as auth_messages
from app.core.constants import ACCESS_COOKIE_NAME
from app.core.db import get_supabase_auth_client
from app.features.auth.session import (
    clear_session_cookies,
    get_current_user_or_raise,
    looks_like_jwt,
)
from app.features.auth.supabase import SupabaseAuthService
from app.features.auth.accounts import (
    build_app_user,
    fetch_user_profile,
    is_super_admin_user,
    profile_is_deleted,
)

logger = get_logger(__name__)


def require_user(request: Request, response: Response) -> AuthUser:
    """Return session user with public.users role and email."""
    auth_user = get_current_user_or_raise(request, response)
    user = build_app_user(auth_user)
    try:
        db_profile = fetch_user_profile(user.id)
    except Exception:
        logger.warning("require_user: profile lookup failed user_id=%s", user.id)
        db_profile = None
    if profile_is_deleted(db_profile):
        clear_session_cookies(response)
        raise HTTPException(status_code=401, detail=auth_messages.ACCOUNT_DELETED)
    if user.account_suspended and user.user_type in ("client", "vendor"):
        raise HTTPException(
            status_code=403,
            detail=auth_messages.ACCOUNT_SUSPENDED_CONTACT,
        )
    bind_sentry_user(user_id=user.id, user_type=user.user_type)
    return user


def require_role(
    request: Request,
    response: Response,
    *,
    role: UserType,
    forbidden_detail: str,
) -> AuthUser:
    """Return the signed-in user if the role matches, else 403."""
    user = require_user(request, response)
    if user.user_type != role:
        logger.warning(
            "require_role denied user_id=%s expected_role=%s actual_role=%s",
            user.id,
            role,
            user.user_type,
        )
        raise HTTPException(status_code=403, detail=forbidden_detail)
    return user


def require_admin(request: Request, response: Response) -> AuthUser:
    user = require_role(
        request,
        response,
        role="admin",
        forbidden_detail=auth_messages.ADMIN_PORTAL_FORBIDDEN,
    )
    if user.account_suspended:
        raise HTTPException(
            status_code=403,
            detail=auth_messages.ADMIN_ACCOUNT_SUSPENDED,
        )
    return user


def require_super_admin(request: Request, response: Response) -> AuthUser:
    user = require_admin(request, response)
    if not is_super_admin_user(user):
        raise HTTPException(
            status_code=403,
            detail=auth_messages.SUPER_ADMIN_ONLY,
        )
    return user


def require_vendor(request: Request, response: Response) -> AuthUser:
    return require_role(
        request,
        response,
        role="vendor",
        forbidden_detail=auth_messages.VENDOR_PORTAL_FORBIDDEN,
    )


def require_client(request: Request, response: Response) -> AuthUser:
    """403 if the signed-in user is not a client (e.g. vendor/admin) or the account is suspended."""
    return require_role(
        request,
        response,
        role="client",
        forbidden_detail=auth_messages.CLIENT_PORTAL_FORBIDDEN,
    )


def get_optional_session_user(request: Request, response: Response) -> AuthUser | None:
    """Return the signed-in user when a valid session cookie is present, else None.

    Public browse routes use this to scope QA test vendors without requiring sign-in.
    Invalid or expired sessions are treated as anonymous (cookies cleared, no 401).
    """
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not access_token:
        return None
    if not looks_like_jwt(access_token):
        clear_session_cookies(response)
        return None

    service = SupabaseAuthService(get_supabase_auth_client())
    result = service.get_user_from_access_token(access_token)
    if not result.get("success"):
        if not result.get("unavailable"):
            clear_session_cookies(response)
        return None

    user = build_app_user(result["user"])
    try:
        db_profile = fetch_user_profile(user.id)
    except Exception:
        logger.warning("get_optional_session_user: profile lookup failed user_id=%s", user.id)
        db_profile = None
    if profile_is_deleted(db_profile):
        clear_session_cookies(response)
        return None
    return user
