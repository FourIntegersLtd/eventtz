"""Vendor moderation emails render exactly as the baseline's did (captured by `vendor_email_goldens.py`).

Covers the admin "vendor submitted" alert, every branch of the approval-change
email, "returned for edits" with and without an admin message, the draft-profile
nudge and the payout-setup nudge. Also checks the guard every `send_*` shares:
a missing or invalid vendor address means nothing is rendered or sent, and it
never raises.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.core.ports import Mailer
from app.features.notifications.service import (
    send_vendor_approval_changed,
    send_vendor_cancellation_policy_nudge,
    send_vendor_payout_nudge,
    send_vendor_profile_nudge,
    send_vendor_returned_for_edits,
    send_vendor_submitted_alert,
)
from tests.support.fakes import FakeMailer

GOLDENS: dict[str, list[dict[str, Any]]] = json.loads(
    (Path(__file__).parent / "notifications" / "vendor_emails.json").read_text(encoding="utf-8")
)


def _assert_matches_golden(mailer: FakeMailer, case: dict[str, Any]) -> None:
    """The one email `mailer` received matches `case`'s recorded subject/html/text.

    Recipients are not compared for the admin alert: the baseline capture used a
    placeholder `to`, while the api reads its staff inbox list from a setting.
    """
    (email,) = mailer.sent
    assert email.subject == case["subject"]
    assert email.html == case["html"]
    assert email.text == case["text"]


@pytest.mark.parametrize("case", GOLDENS["vendor_submitted"], ids=lambda case: case["input"]["label"])
def test_vendor_submitted_alert_matches_baseline(case: dict[str, Any]) -> None:
    """`send_vendor_submitted_alert` renders and sends byte-identically to the baseline."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_vendor_submitted_alert(
        mailer,
        vendor_user_id=submitted["vendor_user_id"],
        vendor_email=submitted["vendor_email"],
        business_name=submitted["business_name"],
    )
    _assert_matches_golden(mailer, case)


@pytest.mark.parametrize("case", GOLDENS["approval"], ids=lambda case: case["input"]["label"])
def test_vendor_approval_changed_matches_baseline(case: dict[str, Any]) -> None:
    """`send_vendor_approval_changed` matches the baseline byte for byte for every approval branch."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_vendor_approval_changed(
        mailer,
        vendor_email=submitted["vendor_email"],
        approval_status=submitted["approval_status"],
        business_name=submitted["business_name"],
        listing_visible=submitted["listing_visible"],
        payouts_verified=submitted["payouts_verified"],
    )
    _assert_matches_golden(mailer, case)


@pytest.mark.parametrize("case", GOLDENS["returned_for_edits"], ids=lambda case: case["input"]["label"])
def test_vendor_returned_for_edits_matches_baseline(case: dict[str, Any]) -> None:
    """`send_vendor_returned_for_edits` matches the baseline, with and without an admin message."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_vendor_returned_for_edits(
        mailer,
        vendor_email=submitted["vendor_email"],
        business_name=submitted["business_name"],
        admin_message=submitted["admin_message"],
    )
    _assert_matches_golden(mailer, case)


@pytest.mark.parametrize("case", GOLDENS["profile_nudge"], ids=lambda case: case["input"]["label"])
def test_vendor_profile_nudge_matches_baseline(case: dict[str, Any]) -> None:
    """`send_vendor_profile_nudge` matches the baseline byte for byte."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_vendor_profile_nudge(
        mailer, vendor_email=submitted["vendor_email"], business_name=submitted["business_name"]
    )
    _assert_matches_golden(mailer, case)


@pytest.mark.parametrize("case", GOLDENS["payout_nudge"], ids=lambda case: case["input"]["label"])
def test_vendor_payout_nudge_matches_baseline(case: dict[str, Any]) -> None:
    """`send_vendor_payout_nudge` matches the baseline byte for byte."""
    mailer = FakeMailer()
    submitted = case["input"]
    assert send_vendor_payout_nudge(
        mailer, vendor_email=submitted["vendor_email"], business_name=submitted["business_name"]
    )
    _assert_matches_golden(mailer, case)


# --- shared guards: every vendor send_* below rejects a missing/invalid address, never raises ---


@pytest.mark.parametrize(
    "send_with_bad_address",
    [
        lambda mailer: send_vendor_approval_changed(
            mailer, vendor_email="not-an-email", approval_status="approved", business_name=None
        ),
        lambda mailer: send_vendor_approval_changed(
            mailer, vendor_email=None, approval_status="approved", business_name=None
        ),
        lambda mailer: send_vendor_returned_for_edits(
            mailer, vendor_email="not-an-email", business_name=None
        ),
        lambda mailer: send_vendor_returned_for_edits(mailer, vendor_email=None, business_name=None),
        lambda mailer: send_vendor_profile_nudge(mailer, vendor_email="not-an-email", business_name=None),
        lambda mailer: send_vendor_profile_nudge(mailer, vendor_email=None, business_name=None),
        lambda mailer: send_vendor_payout_nudge(mailer, vendor_email="not-an-email", business_name=None),
        lambda mailer: send_vendor_payout_nudge(mailer, vendor_email=None, business_name=None),
        lambda mailer: send_vendor_cancellation_policy_nudge(
            mailer, vendor_email="not-an-email", business_name=None
        ),
        lambda mailer: send_vendor_cancellation_policy_nudge(mailer, vendor_email=None, business_name=None),
    ],
    ids=[
        "approval_changed_invalid",
        "approval_changed_missing",
        "returned_for_edits_invalid",
        "returned_for_edits_missing",
        "profile_nudge_invalid",
        "profile_nudge_missing",
        "payout_nudge_invalid",
        "payout_nudge_missing",
        "policy_nudge_invalid",
        "policy_nudge_missing",
    ],
)
def test_send_rejects_missing_or_invalid_vendor_address(
    send_with_bad_address: Callable[[Mailer], bool],
) -> None:
    """Every vendor-email `send_*` returns False, and sends nothing, for a missing/invalid address."""
    mailer = FakeMailer()
    assert send_with_bad_address(mailer) is False
    assert mailer.sent == []


def test_send_vendor_submitted_alert_hands_the_fake_mailer_exactly_one_email() -> None:
    """A single `send_vendor_submitted_alert` call records exactly one email, not zero or several."""
    mailer = FakeMailer()
    assert send_vendor_submitted_alert(
        mailer, vendor_user_id="user-1", vendor_email="vendor@example.com", business_name="Ama's Kitchen"
    )
    assert len(mailer.sent) == 1


def test_cancellation_policy_nudge_names_the_default_and_links_to_the_profile() -> None:
    """The one post-launch email: greeting, the Flexible default, the three shared rules, profile link."""
    mailer = FakeMailer()
    assert send_vendor_cancellation_policy_nudge(
        mailer, vendor_email="vendor@example.com", business_name="Ama's Kitchen"
    )
    (email,) = mailer.sent
    assert email.to == ("vendor@example.com",)
    assert email.subject == "You now decide your refund policy | Eventtz"
    assert "Hi Ama's Kitchen," in email.text
    assert "Until you pick, your profile shows Flexible." in email.text
    assert "our service fee always goes back to the client" in email.text
    assert "/vendor/profile" in email.html
