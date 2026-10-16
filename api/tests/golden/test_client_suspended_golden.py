"""The "account suspended" email renders exactly as the baseline's did (`client_suspended.json`).

Also checks the guard every `send_*` shares: a missing or invalid address sends nothing.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.notifications.service import send_client_suspended_email
from tests.support.fakes import FakeMailer

GOLDENS: dict[str, list[dict[str, Any]]] = json.loads(
    (Path(__file__).parent / "notifications" / "client_suspended.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", GOLDENS["suspended"], ids=lambda case: case["input"]["label"])
def test_client_suspended_matches_baseline(case: dict[str, Any]) -> None:
    """`send_client_suspended_email` renders and sends byte-identically to the baseline."""
    mailer = FakeMailer()
    assert send_client_suspended_email(mailer, to=case["input"]["email"])
    (email,) = mailer.sent
    assert email.to == tuple(case["to"])
    assert email.subject == "Account suspended | Eventtz"
    assert email.html == case["html"]
    assert email.text == case["text"]


@pytest.mark.parametrize("address", [None, "", "not-an-email"])
def test_client_suspended_skips_an_invalid_address(address: str | None) -> None:
    """No address, no email, and no exception."""
    mailer = FakeMailer()
    assert send_client_suspended_email(mailer, to=address) is False
    assert mailer.sent == []
