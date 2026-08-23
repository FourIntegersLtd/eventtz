"""Eligibility for one-shot event-tomorrow, pay-to-confirm, and payouts-setup reminders."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.features.bookings.lifecycle_reminders import (
    should_send_event_tomorrow,
    should_send_pay_to_confirm,
    should_send_payouts_setup,
)
from app.jobs import run_booking_maintenance

NOW = datetime(2026, 8, 23, 12, 0, tzinfo=timezone.utc)


def test_event_tomorrow_only_paid_accepted_next_utc_day() -> None:
    row = {
        "status": "accepted",
        "payment_status": "paid",
        "event_date": "2026-08-24",
        "event_end_date": "2026-08-24",
        "event_tomorrow_reminded_at": None,
    }
    assert should_send_event_tomorrow(row, NOW) is True


def test_event_tomorrow_skips_today_and_already_sent() -> None:
    today = {
        "status": "accepted",
        "payment_status": "paid",
        "event_date": "2026-08-23",
        "event_end_date": "2026-08-23",
        "event_tomorrow_reminded_at": None,
    }
    assert should_send_event_tomorrow(today, NOW) is False
    sent = {
        "status": "accepted",
        "payment_status": "paid",
        "event_date": "2026-08-24",
        "event_tomorrow_reminded_at": NOW.isoformat(),
    }
    assert should_send_event_tomorrow(sent, NOW) is False


def test_event_tomorrow_skips_unpaid() -> None:
    row = {
        "status": "accepted",
        "payment_status": "unpaid",
        "event_date": "2026-08-24",
        "event_tomorrow_reminded_at": None,
    }
    assert should_send_event_tomorrow(row, NOW) is False


def test_pay_to_confirm_after_24h_unpaid_only() -> None:
    accepted = NOW - timedelta(hours=25)
    row = {
        "status": "accepted",
        "payment_status": "unpaid",
        "event_date": "2026-09-01",
        "event_end_date": "2026-09-01",
        "accepted_at": accepted.isoformat(),
        "pay_to_confirm_reminded_at": None,
    }
    assert should_send_pay_to_confirm(row, NOW) is True


def test_pay_to_confirm_skips_pending_checkout() -> None:
    accepted = NOW - timedelta(hours=25)
    row = {
        "status": "accepted",
        "payment_status": "pending",
        "event_date": "2026-09-01",
        "accepted_at": accepted.isoformat(),
        "pay_to_confirm_reminded_at": None,
    }
    assert should_send_pay_to_confirm(row, NOW) is False


def test_pay_to_confirm_skips_too_soon() -> None:
    accepted = NOW - timedelta(hours=2)
    row = {
        "status": "accepted",
        "payment_status": "unpaid",
        "event_date": "2026-09-01",
        "accepted_at": accepted.isoformat(),
        "pay_to_confirm_reminded_at": None,
    }
    assert should_send_pay_to_confirm(row, NOW) is False


def test_payouts_setup_after_24h_if_stripe_not_ready() -> None:
    approved = NOW - timedelta(hours=25)
    row = {
        "approval_status": "approved",
        "approved_at": approved.isoformat(),
        "payouts_setup_nudge_at": None,
        "stripe_account_id": None,
        "stripe_charges_enabled": False,
        "stripe_payouts_enabled": False,
        "listing_override": "auto",
    }
    assert should_send_payouts_setup(row, NOW) is True


def test_payouts_setup_skips_when_stripe_ready() -> None:
    approved = NOW - timedelta(hours=25)
    row = {
        "approval_status": "approved",
        "approved_at": approved.isoformat(),
        "payouts_setup_nudge_at": None,
        "stripe_account_id": "acct_1",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
        "listing_override": "auto",
    }
    assert should_send_payouts_setup(row, NOW) is False


def test_payouts_setup_skips_when_listing_waived() -> None:
    approved = NOW - timedelta(hours=25)
    row = {
        "approval_status": "approved",
        "approved_at": approved.isoformat(),
        "payouts_setup_nudge_at": None,
        "stripe_account_id": None,
        "stripe_charges_enabled": False,
        "stripe_payouts_enabled": False,
        "listing_override": "visible",
    }
    assert should_send_payouts_setup(row, NOW) is False


@patch("app.jobs.run_booking_maintenance.process_lifecycle_reminders", return_value={"event_tomorrow": 0, "pay_to_confirm": 0, "payouts_setup": 0})
@patch("app.jobs.run_booking_maintenance.process_enquiry_response_maintenance", return_value={"vendor_reminders": 0, "client_nudges": 0})
@patch("app.jobs.run_booking_maintenance.mark_stale_enquiries_no_response", return_value=0)
@patch("app.jobs.run_booking_maintenance.process_due_payout_auto_releases", return_value=0)
@patch("app.jobs.run_booking_maintenance.send_completion_reminders", return_value=0)
@patch("app.jobs.run_booking_maintenance.get_settings")
def test_maintenance_calls_lifecycle_reminders(
    mock_settings, _a, _b, _c, _d, mock_lifecycle,
) -> None:
    mock_settings.return_value.enquiry_response_sla_hours = 72
    assert run_booking_maintenance.main() == 0
    mock_lifecycle.assert_called_once_with()
