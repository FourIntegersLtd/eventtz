"""Tests for the booking maintenance CLI job."""

from __future__ import annotations

from unittest.mock import patch

from app.jobs import run_booking_maintenance


@patch("app.jobs.run_booking_maintenance.process_due_payout_auto_releases", return_value=2)
@patch("app.jobs.run_booking_maintenance.send_completion_reminders", return_value=3)
@patch("app.jobs.run_booking_maintenance.get_settings")
def test_main_runs_reminders_then_payouts(mock_settings, mock_reminders, mock_payouts):
    mock_settings.return_value.local_auth_mode = False

    assert run_booking_maintenance.main() == 0

    mock_reminders.assert_called_once_with()
    mock_payouts.assert_called_once_with()


@patch("app.jobs.run_booking_maintenance.process_due_payout_auto_releases")
@patch("app.jobs.run_booking_maintenance.send_completion_reminders")
@patch("app.jobs.run_booking_maintenance.get_settings")
def test_main_skips_in_local_auth_mode(mock_settings, mock_reminders, mock_payouts):
    mock_settings.return_value.local_auth_mode = True

    assert run_booking_maintenance.main() == 0

    mock_reminders.assert_not_called()
    mock_payouts.assert_not_called()
