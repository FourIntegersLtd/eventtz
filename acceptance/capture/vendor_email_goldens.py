"""Capture the vendor moderation emails the baseline renders.

Run with `make capture SCRIPT=capture/vendor_email_goldens.py`. Like
`account_email_goldens.py`, the baseline's Resend call is swapped for a
recorder so nothing is ever sent: each golden holds the exact subject, HTML
and text the baseline would have handed to Resend. Fixed `example.com`
addresses keep the output deterministic.

The admin "vendor submitted" alert is captured through `EmailService` directly
(as `notification_goldens.py` does for the contact alert), not through
`email/dispatch.py`, so the capture never touches `admin_notify_recipients()` -
that list holds real staff addresses which must never land in a fixture. A
placeholder `to=["ops@example.com"]` and `admin_url` are passed in instead;
the api's equivalent recipients come from a setting, so `to` is not compared.

Output: `notifications/vendor_emails.json`, one entry per case below.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

import app.features.email.dispatch as email_dispatch  # type: ignore[import-not-found]
import app.features.email.service as email_service  # type: ignore[import-not-found]

ADMIN_URL = "https://www.eventtz.com/admin/vendors"

VENDOR_SUBMITTED_CASES: list[dict[str, Any]] = [
    {
        "label": "with_business_name",
        "vendor_user_id": "11111111-1111-4111-8111-111111111111",
        "vendor_email": "vendor@example.com",
        "business_name": "Ama's Kitchen",
    },
    {
        "label": "without_business_name",
        "vendor_user_id": "22222222-2222-4222-8222-222222222222",
        "vendor_email": "vendor@example.com",
        "business_name": None,
    },
    {
        "label": "without_vendor_email",
        "vendor_user_id": "33333333-3333-4333-8333-333333333333",
        "vendor_email": None,
        "business_name": "No Email Catering",
    },
]

APPROVAL_CASES: list[dict[str, Any]] = [
    {
        "label": "approved_live",
        "vendor_email": "vendor@example.com",
        "approval_status": "approved",
        "business_name": "Ama's Kitchen",
        "listing_visible": True,
        "payouts_verified": True,
    },
    {
        "label": "approved_live_no_business_name",
        "vendor_email": "vendor@example.com",
        "approval_status": "approved",
        "business_name": None,
        "listing_visible": True,
        "payouts_verified": True,
    },
    {
        "label": "approved_payouts_pending",
        "vendor_email": "vendor@example.com",
        "approval_status": "approved",
        "business_name": "Ama's Kitchen",
        "listing_visible": False,
        "payouts_verified": False,
    },
    {
        "label": "approved_listing_paused",
        "vendor_email": "vendor@example.com",
        "approval_status": "approved",
        "business_name": "Ama's Kitchen",
        "listing_visible": False,
        "payouts_verified": True,
    },
    {
        "label": "banned",
        "vendor_email": "vendor@example.com",
        "approval_status": "banned",
        "business_name": "Ama's Kitchen",
        "listing_visible": False,
        "payouts_verified": False,
    },
    {
        "label": "submitted_under_review",
        "vendor_email": "vendor@example.com",
        "approval_status": "submitted",
        "business_name": "Ama's Kitchen",
        "listing_visible": False,
        "payouts_verified": False,
    },
    {
        "label": "draft_under_review",
        "vendor_email": "vendor@example.com",
        "approval_status": "draft",
        "business_name": None,
        "listing_visible": False,
        "payouts_verified": False,
    },
]

RETURNED_FOR_EDITS_CASES: list[dict[str, Any]] = [
    {
        "label": "with_message_and_business_name",
        "vendor_email": "vendor@example.com",
        "business_name": "Ama's Kitchen",
        "admin_message": "Please add clearer photos of your last three events.",
    },
    {
        "label": "without_message",
        "vendor_email": "vendor@example.com",
        "business_name": "Ama's Kitchen",
        "admin_message": None,
    },
    {
        "label": "without_business_name_or_message",
        "vendor_email": "vendor@example.com",
        "business_name": None,
        "admin_message": None,
    },
]

PROFILE_NUDGE_CASES: list[dict[str, Any]] = [
    {
        "label": "with_business_name",
        "vendor_email": "vendor@example.com",
        "business_name": "Ama's Kitchen",
    },
    {
        "label": "without_business_name",
        "vendor_email": "jane.doe@example.com",
        "business_name": None,
    },
]

PAYOUT_NUDGE_CASES: list[dict[str, Any]] = [
    {
        "label": "with_business_name",
        "vendor_email": "vendor@example.com",
        "business_name": "Ama's Kitchen",
    },
    {
        "label": "without_business_name",
        "vendor_email": "jane.doe@example.com",
        "business_name": None,
    },
]


def _record_send() -> tuple[dict[str, Any], Callable[..., bool]]:
    """A stand-in for Resend that keeps what would have been sent instead of sending it."""
    sent: dict[str, Any] = {}

    def record_send(**email: Any) -> bool:
        """Keep the call's keyword arguments (to, subject, html, text) and report success."""
        sent.update(email)
        return True

    return sent, record_send


def _golden_entry(case: dict[str, Any], sent: dict[str, Any]) -> dict[str, Any]:
    """One golden entry: the case that produced it, plus the subject/html/text sent."""
    return {
        "input": case,
        "subject": sent["subject"],
        "html": sent["html"],
        "text": sent["text"],
    }


def capture_vendor_submitted(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline admin "vendor submitted" alert for one case without sending it.

    Calls `EmailService.send_admin_vendor_submitted` directly (bypassing
    `email/dispatch.py`) so the real `ADMIN_NOTIFY_RECIPIENTS` list is never touched.
    """
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_service.EmailService().send_admin_vendor_submitted(
        vendor_user_id=case["vendor_user_id"],
        vendor_email=case["vendor_email"],
        business_name=case["business_name"],
        to=["ops@example.com"],
        admin_url=ADMIN_URL,
    )
    return _golden_entry(case, sent)


def capture_approval(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline vendor approval-change email for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_vendor_approval_email(
        vendor_user_id="00000000-0000-4000-8000-000000000000",
        vendor_email=case["vendor_email"],
        approval_status=case["approval_status"],
        business_name=case["business_name"],
        listing_visible=case["listing_visible"],
        payouts_verified=case["payouts_verified"],
    )
    return _golden_entry(case, sent)


def capture_returned_for_edits(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline "returned for edits" email for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_vendor_returned_for_edits_email(
        vendor_user_id="00000000-0000-4000-8000-000000000000",
        vendor_email=case["vendor_email"],
        business_name=case["business_name"],
        admin_message=case["admin_message"],
    )
    return _golden_entry(case, sent)


def capture_profile_nudge(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline draft-profile nudge email for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_vendor_complete_profile_nudge_email(
        vendor_user_id="00000000-0000-4000-8000-000000000000",
        vendor_email=case["vendor_email"],
        business_name=case["business_name"],
    )
    return _golden_entry(case, sent)


def capture_payout_nudge(case: dict[str, Any]) -> dict[str, Any]:
    """Render the baseline payout-setup nudge email for one case without sending it."""
    sent, record_send = _record_send()
    email_service.resend_send = record_send
    email_dispatch.send_vendor_setup_payouts_nudge_email(
        vendor_user_id="00000000-0000-4000-8000-000000000000",
        vendor_email=case["vendor_email"],
        business_name=case["business_name"],
    )
    return _golden_entry(case, sent)


if __name__ == "__main__":
    golden_path = Path(sys.argv[1]) / "notifications" / "vendor_emails.json"
    golden_path.parent.mkdir(parents=True, exist_ok=True)
    captured = {
        "vendor_submitted": [capture_vendor_submitted(case) for case in VENDOR_SUBMITTED_CASES],
        "approval": [capture_approval(case) for case in APPROVAL_CASES],
        "returned_for_edits": [capture_returned_for_edits(case) for case in RETURNED_FOR_EDITS_CASES],
        "profile_nudge": [capture_profile_nudge(case) for case in PROFILE_NUDGE_CASES],
        "payout_nudge": [capture_payout_nudge(case) for case in PAYOUT_NUDGE_CASES],
    }
    golden_path.write_text(json.dumps(captured, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
