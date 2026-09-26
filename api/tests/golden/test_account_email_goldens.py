"""Account emails render exactly as the baseline's did (captured by `account_email_goldens.py`).

Also checks the guard every `send_*` function shares: no "@" in the address
means nothing is rendered or sent, and a valid send hands the fake mailer
exactly one email.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.core.ports import Mailer
from app.features.notifications.service import (
    send_email_verification,
    send_password_changed,
    send_password_reset,
    send_welcome,
)
from tests.support.fakes import FakeMailer

GOLDENS: dict[str, list[dict[str, Any]]] = json.loads(
    (Path(__file__).parent / "notifications" / "account_emails.json").read_text(encoding="utf-8")
)


def _assert_matches_golden(mailer: FakeMailer, case: dict[str, Any]) -> None:
    """The one email `mailer` received matches `case`'s recorded `to`/subject/html/text."""
    (email,) = mailer.sent
    assert list(email.to) == case["to"]
    assert email.subject == case["subject"]
    assert email.html == case["html"]
    assert email.text == case["text"]


@pytest.mark.parametrize("case", GOLDENS["verification"], ids=lambda case: case["input"]["label"])
def test_email_verification_matches_baseline(case: dict[str, Any]) -> None:
    """`send_email_verification` renders and sends byte-identically to the baseline."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_email_verification(
        mailer, email=submitted["email"], verify_url=submitted["verify_url"], user_type=submitted["user_type"]
    )
    _assert_matches_golden(mailer, case)


@pytest.mark.parametrize("case", GOLDENS["reset"], ids=lambda case: case["input"]["label"])
def test_password_reset_matches_baseline(case: dict[str, Any]) -> None:
    """`send_password_reset` (both reset and admin setup) matches the baseline byte for byte."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_password_reset(
        mailer,
        email=submitted["email"],
        reset_url=submitted["reset_url"],
        user_type=submitted["user_type"],
        purpose=submitted["purpose"],
    )
    _assert_matches_golden(mailer, case)


@pytest.mark.parametrize("case", GOLDENS["password_changed"], ids=lambda case: case["input"]["label"])
def test_password_changed_matches_baseline(case: dict[str, Any]) -> None:
    """`send_password_changed` matches the baseline byte for byte, including the login link it builds."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_password_changed(mailer, email=submitted["email"], user_type=submitted["user_type"])
    _assert_matches_golden(mailer, case)


@pytest.mark.parametrize("case", GOLDENS["welcome"], ids=lambda case: case["input"]["label"])
def test_welcome_matches_baseline(case: dict[str, Any]) -> None:
    """`send_welcome` (client, vendor and admin) matches the baseline byte for byte."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_welcome(mailer, email=submitted["email"], user_type=submitted["user_type"])
    _assert_matches_golden(mailer, case)


# --- shared guards: every send_* below rejects an address without "@" and never raises ------


@pytest.mark.parametrize(
    "send_with_bad_address",
    [
        lambda mailer: send_email_verification(mailer, email="not-an-email", verify_url="https://x/y"),
        lambda mailer: send_password_reset(mailer, email="not-an-email", reset_url="https://x/y"),
        lambda mailer: send_password_changed(mailer, email="not-an-email"),
        lambda mailer: send_welcome(mailer, email="not-an-email", user_type="client"),
    ],
    ids=["email_verification", "password_reset", "password_changed", "welcome"],
)
def test_send_rejects_address_without_at_sign(send_with_bad_address: Callable[[Mailer], bool]) -> None:
    """Every account-email `send_*` returns False, and sends nothing, for an address missing "@"."""
    mailer = FakeMailer()
    assert send_with_bad_address(mailer) is False
    assert mailer.sent == []


def test_send_welcome_hands_the_fake_mailer_exactly_one_email() -> None:
    """A single valid `send_welcome` call records exactly one email, not zero or several."""
    mailer = FakeMailer()
    assert send_welcome(mailer, email="person@example.com", user_type="client")
    assert len(mailer.sent) == 1
