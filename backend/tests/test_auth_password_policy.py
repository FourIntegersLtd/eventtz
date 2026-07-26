"""Tests for password policy and admin team helpers."""

from __future__ import annotations

import pytest

from app.features.auth.password_policy import validate_admin_password, validate_password_for_user


def test_validate_admin_password_requires_length_and_complexity() -> None:
    with pytest.raises(ValueError, match="12 characters"):
        validate_admin_password("Short1a")
    with pytest.raises(ValueError, match="uppercase"):
        validate_admin_password("alllowercase1")
    with pytest.raises(ValueError, match="lowercase"):
        validate_admin_password("ALLUPPERCASE1")
    with pytest.raises(ValueError, match="number"):
        validate_admin_password("NoNumbersHere")
    validate_admin_password("StrongPass123")


def test_validate_password_for_user_client_min_six() -> None:
    validate_password_for_user("abcdef", "client")
    with pytest.raises(ValueError, match="6 characters"):
        validate_password_for_user("abc", "client")


def test_validate_password_for_user_admin_stricter() -> None:
    with pytest.raises(ValueError, match="12 characters"):
        validate_password_for_user("abcdef", "admin")
