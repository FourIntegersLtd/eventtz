"""The bookings slice schedules its maintenance on the worker, hourly."""

from __future__ import annotations

from app.core.jobs import get_jobs_app, registered_task_names


def test_booking_maintenance_is_registered_to_run_every_hour() -> None:
    """The worker knows the task, and procrastinate defers it at the top of each hour."""
    periodic_crons = {
        task_name: periodic.cron
        for (task_name, _periodic_id), periodic in get_jobs_app().periodic_registry.periodic_tasks.items()
    }

    assert "bookings.run_booking_maintenance" in registered_task_names()
    assert periodic_crons["bookings.run_booking_maintenance"] == "0 * * * *"
