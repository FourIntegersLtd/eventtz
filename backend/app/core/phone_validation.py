"""Shared phone number format checks (UK + international)."""

from __future__ import annotations

import re

PHONE_MIN_DIGITS = 10
PHONE_MAX_DIGITS = 15
PHONE_MAX_LENGTH = 40


def phone_digits_only(phone: str) -> str:
    return re.sub(r"\D", "", phone)


def is_valid_phone_number(phone: str) -> bool:
    trimmed = phone.strip()
    if not trimmed or len(trimmed) > PHONE_MAX_LENGTH:
        return False

    if trimmed.startswith("+"):
        digits = phone_digits_only(trimmed[1:])
        return PHONE_MIN_DIGITS <= len(digits) <= PHONE_MAX_DIGITS

    digits = phone_digits_only(trimmed)
    if trimmed.startswith("0"):
        return 10 <= len(digits) <= 11

    return PHONE_MIN_DIGITS <= len(digits) <= PHONE_MAX_DIGITS
