"""Tests for password policy and admin team helpers."""

from __future__ import annotations

import pytest

from app.features.auth.password_policy import validate_admin_password, validate_password_for_user


def test_validate_admin_password_requires_length_and_complexity() -> None:
    with pytest.raises(ValueError, match="6 characters"):
        validate_admin_password("Ab1!")
    with pytest.raises(ValueError, match="uppercase"):
        validate_admin_password("lowercase1!")
    with pytest.raises(ValueError, match="number"):
        validate_admin_password("NoNumbers!")
    with pytest.raises(ValueError, match="symbol"):
        validate_admin_password("NoSymbol1")
    validate_admin_password("Strong1!")


def test_validate_password_for_user_client_min_six() -> None:
    validate_password_for_user("abcdef", "client")
    with pytest.raises(ValueError, match="6 characters"):
        validate_password_for_user("abc", "client")


def test_validate_password_for_user_admin_stricter() -> None:
    with pytest.raises(ValueError, match="uppercase"):
        validate_password_for_user("lowercase1!", "admin")
