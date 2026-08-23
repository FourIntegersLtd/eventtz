"""In-process booking maintenance scheduler and job lock."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from postgrest.exceptions import APIError

from app.jobs.lock import try_claim_job_period
from app.jobs.scheduler import (
    hour_period_key,
    run_locked_maintenance,
    should_start_scheduler,
)


def test_hour_period_key_is_utc_hour() -> None:
    now = datetime(2026, 8, 23, 14, 37, tzinfo=timezone.utc)
    assert hour_period_key(now) == "2026-08-23T14"


def test_scheduler_off_when_not_production() -> None:
    settings = SimpleNamespace(is_production=False, booking_maintenance_interval_seconds=3600)
    assert should_start_scheduler(settings) is False


def test_scheduler_off_when_interval_zero() -> None:
    settings = SimpleNamespace(is_production=True, booking_maintenance_interval_seconds=0)
    assert should_start_scheduler(settings) is False


def test_scheduler_on_in_production() -> None:
    settings = SimpleNamespace(is_production=True, booking_maintenance_interval_seconds=3600)
    assert should_start_scheduler(settings) is True


@patch("app.jobs.lock.get_db")
def test_claim_skips_when_period_taken(mock_get_db: MagicMock) -> None:
    mock_get_db.return_value.table.return_value.insert.return_value.execute.side_effect = (
        Exception("duplicate key value violates unique constraint 23505")
    )
    assert try_claim_job_period("booking_maintenance", "2026-08-23T14") is False


@patch("app.jobs.lock.get_db")
def test_claim_runs_when_table_missing(mock_get_db: MagicMock) -> None:
    mock_get_db.return_value.table.return_value.insert.return_value.execute.side_effect = (
        Exception('relation "job_runs" does not exist')
    )
    assert try_claim_job_period("booking_maintenance", "2026-08-23T14") is True


@patch("app.jobs.lock.get_db")
def test_claim_runs_when_postgrest_schema_cache_misses_table(mock_get_db: MagicMock) -> None:
    mock_get_db.return_value.table.return_value.insert.return_value.execute.side_effect = (
        APIError(
            {
                "message": "Could not find the table 'public.job_runs' in the schema cache",
                "code": "PGRST205",
                "hint": None,
                "details": None,
            }
        )
    )
    assert try_claim_job_period("booking_maintenance", "2026-08-23T14") is True


@patch("app.jobs.scheduler.run_booking_maintenance_main")
@patch("app.jobs.scheduler.try_claim_job_period", return_value=False)
def test_locked_run_skips_work_when_not_claimed(
    _mock_claim: MagicMock,
    mock_main: MagicMock,
    caplog,
) -> None:
    with caplog.at_level("INFO"):
        run_locked_maintenance()
    mock_main.assert_not_called()
    assert "booking maintenance tick period=" in caplog.text
    assert "booking maintenance skipped" in caplog.text
    assert "reason=lock_not_acquired" in caplog.text


@patch("app.jobs.scheduler.run_booking_maintenance_main")
@patch("app.jobs.scheduler.try_claim_job_period", return_value=True)
def test_locked_run_logs_failure_when_job_raises(
    _mock_claim: MagicMock,
    mock_main: MagicMock,
    caplog,
) -> None:
    mock_main.side_effect = RuntimeError("boom")
    with caplog.at_level("ERROR"):
        try:
            run_locked_maintenance()
        except RuntimeError:
            pass
        else:
            raise AssertionError("expected RuntimeError")
    assert "booking maintenance failed period=" in caplog.text
    assert "duration_ms=" in caplog.text
