"""Tests for the booking maintenance CLI job."""

from __future__ import annotations

from unittest.mock import patch

from app.jobs import run_booking_maintenance


@patch("app.jobs.run_booking_maintenance.process_enquiry_response_maintenance", return_value={"vendor_reminders": 0, "client_nudges": 0})
@patch("app.jobs.run_booking_maintenance.mark_stale_enquiries_no_response", return_value=0)
@patch("app.jobs.run_booking_maintenance.process_due_payout_auto_releases", return_value=2)
@patch("app.jobs.run_booking_maintenance.send_completion_reminders", return_value=3)
@patch("app.jobs.run_booking_maintenance.get_settings")
def test_main_runs_reminders_then_payouts(
    mock_settings, mock_reminders, mock_payouts, mock_payouts_auto, _mock_enquiry,
):
    mock_settings.return_value.enquiry_response_sla_hours = 48

    assert run_booking_maintenance.main() == 0

    mock_reminders.assert_called_once_with()
    mock_payouts.assert_called_once_with()
