"""Password strength rules — stricter for admin accounts."""

from __future__ import annotations

import re

ADMIN_MIN_LENGTH = 12
DEFAULT_MIN_LENGTH = 6


def validate_password_for_user(password: str, user_type: str | None) -> None:
    """Raise ValueError with a user-safe message when password is too weak."""
    if user_type == "admin":
        validate_admin_password(password)
        return
    if len(password) < DEFAULT_MIN_LENGTH:
        raise ValueError("Password must be at least 6 characters.")


def validate_admin_password(password: str) -> None:
    if len(password) < ADMIN_MIN_LENGTH:
        raise ValueError(f"Admin password must be at least {ADMIN_MIN_LENGTH} characters.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Admin password must include an uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise ValueError("Admin password must include a lowercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Admin password must include a number.")
