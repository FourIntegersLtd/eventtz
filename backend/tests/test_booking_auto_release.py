"""Tests for post-event payout auto-release and completion reminders."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from app.features.bookings import payments
from app.features.bookings.completion_rules import (
    completion_waiting_on,
    compute_payout_auto_release_at,
)


def _paid_row(event_days_ago: int, **overrides) -> dict:
    event_date = (datetime.now(timezone.utc) - timedelta(days=event_days_ago)).date().isoformat()
    row = {
        "id": "b1",
        "status": "accepted",
        "payment_status": "paid",
        "event_date": event_date,
        "event_end_date": None,
        "client_user_id": "c1",
        "vendor_user_id": "v1",
        "payout_auto_released_at": None,
        "client_completion_confirmed_at": None,
        "vendor_completion_confirmed_at": None,
    }
    row.update(overrides)
    return row


def test_auto_release_at_none_when_not_paid():
    assert compute_payout_auto_release_at(_paid_row(5, payment_status="unpaid")) is None
    assert compute_payout_auto_release_at(_paid_row(5, status="completed")) is None


def test_auto_release_at_is_48h_after_event_day_ends():
    row = _paid_row(0)
    release_at = compute_payout_auto_release_at(row)
    event_day = datetime.strptime(row["event_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    assert release_at == event_day + timedelta(days=1, hours=48)


def test_auto_release_at_uses_event_end_date_for_multi_day_events():
    end = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
    row = _paid_row(1, event_end_date=end)
    release_at = compute_payout_auto_release_at(row)
    end_day = datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    assert release_at == end_day + timedelta(days=1, hours=48)


def test_completion_waiting_on():
    assert completion_waiting_on(_paid_row(1)) == "both"
    assert completion_waiting_on(_paid_row(1, client_completion_confirmed_at="t")) == "vendor"
    assert completion_waiting_on(_paid_row(1, vendor_completion_confirmed_at="t")) == "client"
    assert completion_waiting_on(_paid_row(1, payment_status="unpaid")) is None


@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.payment_maintenance._finalize_completion")
@patch("app.features.bookings.payment_maintenance.get_client")
def test_due_booking_auto_releases_payout(mock_get_client, mock_finalize, _dispute):
    mock_finalize.return_value = {"payment_status": "payout_released"}
    mock_table = MagicMock()
    mock_get_client.return_value.table.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table

    assert payments._auto_release_payout_row(_paid_row(5)) is True
    mock_finalize.assert_called_once()
    update_payload = mock_table.update.call_args[0][0]
    assert update_payload["payout_auto_released_at"]


@patch("app.features.bookings.payment_maintenance._finalize_completion")
def test_auto_release_waits_until_window_passes(mock_finalize):
    # Event was today: the 48h window hasn't started, let alone passed.
    assert payments._auto_release_payout_row(_paid_row(0)) is False
    mock_finalize.assert_not_called()


@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=True)
@patch("app.features.bookings.payment_maintenance._finalize_completion")
def test_auto_release_blocked_by_open_dispute(mock_finalize, _dispute):
    assert payments._auto_release_payout_row(_paid_row(5)) is False
    mock_finalize.assert_not_called()


@patch("app.features.bookings.disputes.has_active_dispute_for_booking", return_value=False)
@patch("app.features.bookings.payment_maintenance._finalize_completion")
def test_auto_release_not_marked_when_payout_not_released(mock_finalize, _dispute):
    # e.g. vendor Stripe account not ready — booking stays eligible for a later run.
    mock_finalize.return_value = {"payment_status": "paid"}
    assert payments._auto_release_payout_row(_paid_row(5)) is False


@patch("app.features.bookings.payment_completion._finalize_completion")
@patch("app.features.bookings.payment_completion.dispatch_booking_notification")
@patch("app.features.bookings.payment_completion.get_settings")
@patch("app.features.bookings.payment_completion.get_client")
def test_mutual_confirm_still_releases_immediately(
    mock_get_client, mock_settings, _upsert, mock_finalize,
):
    mock_settings.return_value.local_auth_mode = False
    mock_finalize.return_value = {"payment_status": "payout_released"}
    mock_table = MagicMock()
    mock_get_client.return_value.table.return_value = mock_table
    for m in ("select", "eq", "limit", "update", "is_"):
        getattr(mock_table, m).return_value = mock_table
    row = _paid_row(1, vendor_completion_confirmed_at="2026-01-01T00:00:00Z")
    updated = {**row, "client_completion_confirmed_at": "2026-01-02T00:00:00Z"}
    mock_table.execute.side_effect = [MagicMock(data=[row]), MagicMock(data=[updated])]

    payments.confirm_completion_for_client("c1", "b1")
    mock_finalize.assert_called_once()


@patch("app.features.bookings.payment_shared._notify_pair")
@patch("app.features.bookings.payment_maintenance.dispatch_booking_notification")
@patch("app.features.bookings.payment_maintenance.get_client")
@patch("app.features.bookings.payment_maintenance._due_completion_candidates")
@patch("app.features.bookings.payment_maintenance.get_settings")
def test_reminder_targets_only_unconfirmed_party(
    mock_settings, mock_candidates, mock_get_client, mock_upsert, _notify,
):
    mock_settings.return_value.local_auth_mode = False
    mock_table = MagicMock()
    mock_get_client.return_value.table.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_candidates.return_value = [
        _paid_row(2, vendor_completion_confirmed_at="2026-01-01T00:00:00Z"),
    ]

    assert payments.send_completion_reminders() == 1
    kinds = [c.kwargs["kind"] for c in mock_upsert.call_args_list]
    assert kinds == ["completion_reminder"]
    # Marks the booking so the next maintenance run skips it (dedupe).
    update_payload = mock_table.update.call_args[0][0]
    assert update_payload["completion_reminder_sent_at"]


@patch("app.features.bookings.payment_maintenance.dispatch_booking_notification")
@patch("app.features.bookings.payment_maintenance._due_completion_candidates")
@patch("app.features.bookings.payment_maintenance.get_settings")
def test_no_reminder_while_event_day_still_running(mock_settings, mock_candidates, mock_upsert):
    mock_settings.return_value.local_auth_mode = False
    mock_candidates.return_value = [_paid_row(0)]

    assert payments.send_completion_reminders() == 0
    mock_upsert.assert_not_called()


@patch("app.features.bookings.payment_maintenance.get_client")
def test_due_candidates_skip_multi_day_event_before_end(mock_get_client):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    row = _paid_row(1, event_end_date=tomorrow)
    mock_table = MagicMock()
    mock_get_client.return_value.table.return_value = mock_table
    for m in ("select", "eq", "is_", "limit"):
        getattr(mock_table, m).return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[row])

    candidates = payments._due_completion_candidates(50, extra_null_col="payout_auto_released_at")
    assert candidates == []


@patch("app.features.bookings.payment_maintenance._auto_release_payout_row", return_value=True)
@patch("app.features.bookings.payment_maintenance.maybe_send_completion_reminder_for_row", return_value=True)
def test_touch_booking_completion_side_effects_runs_both(mock_reminder, mock_release):
    row = _paid_row(5)
    assert payments.touch_booking_completion_side_effects(row) is True
    mock_reminder.assert_called_once_with(row)
    mock_release.assert_called_once_with(row)


@patch("app.features.bookings.payment_maintenance.maybe_send_completion_reminder_for_row", return_value=True)
@patch("app.features.bookings.payment_maintenance.get_settings")
def test_list_touch_reminders_only_no_payout(mock_settings, mock_reminder):
    mock_settings.return_value.local_auth_mode = False
    rows = [_paid_row(5, id=f"b{i}") for i in range(15)]
    with patch("app.features.bookings.payment_maintenance._auto_release_payout_row") as mock_release:
        payments.touch_completion_side_effects_for_booking_rows(rows, cap=10)
        assert mock_reminder.call_count == 10
        mock_release.assert_not_called()
