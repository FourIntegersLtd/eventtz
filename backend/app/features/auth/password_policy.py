"""Password strength rules - stricter for admin accounts."""

from __future__ import annotations

import re

from app.features.auth import messages as auth_messages

ADMIN_MIN_LENGTH = 6
DEFAULT_MIN_LENGTH = 6


def validate_password_for_user(password: str, user_type: str | None) -> None:
    """Raise ValueError with a user-safe message when password is too weak."""
    if user_type == "admin":
        validate_admin_password(password)
        return
    if len(password) < DEFAULT_MIN_LENGTH:
        raise ValueError(auth_messages.password_min_length_detail(DEFAULT_MIN_LENGTH))


def validate_admin_password(password: str) -> None:
    if len(password) < ADMIN_MIN_LENGTH:
        raise ValueError(auth_messages.admin_password_min_length_detail(ADMIN_MIN_LENGTH))
    if not re.search(r"[A-Z]", password):
        raise ValueError(auth_messages.ADMIN_PASSWORD_UPPERCASE)
    if not re.search(r"[0-9]", password):
        raise ValueError(auth_messages.ADMIN_PASSWORD_NUMBER)
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError(auth_messages.ADMIN_PASSWORD_SYMBOL)
