"""Reusable auth + role guards for endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request, Response

from app.core.logging import get_logger
from app.contracts.types import UserType
from app.features.auth.session import get_current_user_or_raise
from app.features.auth.accounts import hydrate_user_from_db

logger = get_logger(__name__)


def require_user(request: Request, response: Response) -> dict[str, Any]:
    """Return session user with public.users role and email."""
    auth_user = get_current_user_or_raise(request, response)
    user = hydrate_user_from_db(auth_user)
    if user.get("account_suspended") and user.get("user_type") in ("client", "vendor"):
        raise HTTPException(
            status_code=403,
            detail=(
                "Your account has been suspended. "
                "Contact support if you think this is a mistake."
            ),
        )
    return user


def require_role(
    request: Request,
    response: Response,
    *,
    role: UserType,
    forbidden_detail: str,
) -> dict[str, Any]:
    """Return merged user if role matches, else 403."""
    user = require_user(request, response)
    if user.get("user_type") != role:
        logger.warning(
            "require_role denied user_id=%s expected_role=%s actual_role=%s",
            user.get("id"),
            role,
            user.get("user_type"),
        )
        raise HTTPException(status_code=403, detail=forbidden_detail)
    return user


def require_admin(request: Request, response: Response) -> dict[str, Any]:
    return require_role(
        request,
        response,
        role="admin",
        forbidden_detail=(
            "This area is for admin accounts only. "
            "If you're a vendor or client, use the matching sign-in page."
        ),
    )


def require_vendor(request: Request, response: Response) -> dict[str, Any]:
    return require_role(
        request,
        response,
        role="vendor",
        forbidden_detail=(
            "This page is for vendor accounts. "
            "If you offer services on Eventtz, create a vendor account or sign out and sign in again "
            "so we can refresh your account type. "
            "If you're planning an event, use client sign-in instead."
        ),
    )


def require_client(request: Request, response: Response) -> dict[str, Any]:
    """403 if JWT user_type is not client (e.g. vendor/admin) or account is suspended."""
    return require_role(
        request,
        response,
        role="client",
        forbidden_detail=(
            "Booking requests are for client accounts. "
            "Sign in with a client account, or create one from the homepage."
        ),
    )
