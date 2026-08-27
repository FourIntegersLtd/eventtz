"""Tests for the booking maintenance CLI job."""

from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest

from app.jobs import run_booking_maintenance


@patch("app.jobs.run_booking_maintenance.process_lifecycle_reminders", return_value={"event_tomorrow": 0, "pay_to_confirm": 0, "payouts_setup": 0})
@patch("app.jobs.run_booking_maintenance.process_enquiry_response_maintenance", return_value={"vendor_reminders": 0, "client_nudges": 0})
@patch("app.jobs.run_booking_maintenance.mark_stale_enquiries_no_response", return_value=0)
@patch("app.jobs.run_booking_maintenance.process_due_payout_auto_releases", return_value=2)
@patch("app.jobs.run_booking_maintenance.send_completion_reminders", return_value=3)
@patch("app.jobs.run_booking_maintenance.get_settings")
def test_main_runs_reminders_then_payouts(
    mock_settings, mock_reminders, mock_payouts, mock_payouts_auto, _mock_enquiry, _mock_lifecycle, caplog,
):
    mock_settings.return_value.enquiry_response_sla_hours = 48

    with caplog.at_level("INFO"):
        assert run_booking_maintenance.main() == 0

    mock_reminders.assert_called_once_with()
    mock_payouts.assert_called_once_with()
    assert "booking maintenance job started" in caplog.text
    assert "booking maintenance run complete" in caplog.text
    assert "reminders=3" in caplog.text
    assert "payouts_released=2" in caplog.text


@patch("app.jobs.run_booking_maintenance.process_lifecycle_reminders", return_value={"event_tomorrow": 1, "pay_to_confirm": 0, "payouts_setup": 0})
@patch("app.jobs.run_booking_maintenance.process_enquiry_response_maintenance", return_value={"vendor_reminders": 0, "client_nudges": 0})
@patch("app.jobs.run_booking_maintenance.mark_stale_enquiries_no_response", return_value=0)
@patch("app.jobs.run_booking_maintenance.process_due_payout_auto_releases", return_value=2)
@patch(
    "app.jobs.run_booking_maintenance.send_completion_reminders",
    side_effect=httpx.ReadTimeout("The read operation timed out"),
)
@patch("app.jobs.run_booking_maintenance.get_settings")
def test_main_continues_when_reminder_query_times_out(
    mock_settings, mock_reminders, mock_payouts, mock_stale, mock_enquiry, mock_lifecycle, caplog,
):
    mock_settings.return_value.enquiry_response_sla_hours = 48

    with caplog.at_level("INFO"):
        assert run_booking_maintenance.main() == 0

    mock_reminders.assert_called_once_with()
    mock_payouts.assert_called_once_with()
    mock_stale.assert_called_once()
    mock_enquiry.assert_called_once_with()
    mock_lifecycle.assert_called_once_with()
    assert "booking maintenance step unavailable name=completion_reminders" in caplog.text
    assert "reminders=0" in caplog.text
    assert "payouts_released=2" in caplog.text
    assert "event_tomorrow=1" in caplog.text


@patch("app.jobs.run_booking_maintenance.process_due_payout_auto_releases")
@patch(
    "app.jobs.run_booking_maintenance.send_completion_reminders",
    side_effect=RuntimeError("boom"),
)
@patch("app.jobs.run_booking_maintenance.get_settings")
def test_main_still_raises_unexpected_errors(
    mock_settings, _mock_reminders, mock_payouts,
) -> None:
    mock_settings.return_value.enquiry_response_sla_hours = 48
    with pytest.raises(RuntimeError, match="boom"):
        run_booking_maintenance.main()
    mock_payouts.assert_not_called()
