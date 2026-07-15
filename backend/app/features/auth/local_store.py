"""In-memory users and sessions when LOCAL_AUTH_MODE is on (local development only)."""

from __future__ import annotations

import hashlib
import secrets
from typing import Any, Literal
from uuid import uuid4

from app.core.config import get_settings


def enabled() -> bool:
    return get_settings().local_auth_mode


_local_users_by_email: dict[str, dict[str, Any]] = {}
_local_access_tokens: dict[str, str] = {}
_local_refresh_tokens: dict[str, str] = {}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def build_user(
    email: str,
    user_type: Literal["client", "vendor", "admin"] = "client",
) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "email": email,
        "user_type": user_type,
        "user_metadata": {},
        "app_metadata": {"provider": "local_mock"},
    }


def register_user(email: str, password: str, user_type: Literal["client", "vendor", "admin"]) -> dict[str, Any]:
    email = normalize_email(email)
    if email in _local_users_by_email:
        raise ValueError("Email already registered")
    user = build_user(email, user_type)
    _local_users_by_email[email] = {
        "user": user,
        "password_hash": password_hash(password),
    }
    return user


def authenticate(email: str, password: str) -> dict[str, Any] | None:
    email = normalize_email(email)
    record = _local_users_by_email.get(email)
    if not record or record["password_hash"] != password_hash(password):
        return None
    return record["user"]


def create_session(email: str) -> dict[str, Any]:
    email = normalize_email(email)
    access_token = f"local_access_{secrets.token_urlsafe(24)}"
    refresh_token = f"local_refresh_{secrets.token_urlsafe(24)}"
    _local_access_tokens[access_token] = email
    _local_refresh_tokens[refresh_token] = email
    return {"access_token": access_token, "refresh_token": refresh_token}


def user_for_access_token(access_token: str) -> dict[str, Any] | None:
    email = _local_access_tokens.get(access_token)
    if not email:
        return None
    record = _local_users_by_email.get(email)
    return record["user"] if record else None


def email_for_refresh_token(refresh_token: str) -> str | None:
    return _local_refresh_tokens.get(refresh_token)


def revoke_refresh_token(refresh_token: str) -> None:
    _local_refresh_tokens.pop(refresh_token, None)


def revoke_access_token(access_token: str) -> None:
    _local_access_tokens.pop(access_token, None)


def user_record_for_email(email: str) -> dict[str, Any] | None:
    record = _local_users_by_email.get(normalize_email(email))
    return record["user"] if record else None
