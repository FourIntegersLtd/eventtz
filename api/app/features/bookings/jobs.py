"""The hourly booking maintenance, run by the procrastinate worker (ADR 0008).

Replaces the baseline's in-process scheduler. Each hour, in the baseline's order:
completion reminders, automatic vendor payouts, stale-enquiry marking and vendor
enquiry reminders. Each booking that may move money gets its own transaction, so
one failure never undoes another booking's payout.

`run_booking_maintenance_once` holds the work and takes its adapters as arguments,
so tests call it with fakes; the registered task only plugs in the real adapters.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.resend_mailer import ResendMailer
from app.adapters.stripe_payments import StripePaymentGateway
from app.core.db import job_session
from app.core.jobs import get_jobs_app
from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway
from app.features.bookings import service_maintenance

log = get_logger(__name__)

MAINTENANCE_TASK_NAME = "bookings.run_booking_maintenance"
# Top of every hour, as the baseline's scheduler ran it.
_HOURLY_CRON = "0 * * * *"

# One maintenance step for one booking: True when it sent or paid something.
BookingStep = Callable[[AsyncSession, str], Awaitable[bool]]


async def _for_each_booking(unset_column: str, step_name: str, run_step: BookingStep) -> int:
    """Run `run_step` on each due booking, one transaction per booking; returns how many acted."""
    async with job_session() as session:
        booking_ids = await service_maintenance.due_post_event_booking_ids(session, unset_column=unset_column)
    acted = 0
    for booking_id in booking_ids:
        try:
            async with job_session() as session:
                if await run_step(session, booking_id):
                    acted += 1
        except Exception:
            # One broken booking must not stop the rest; Sentry sees the logged exception.
            log.exception("bookings: %s failed booking=%s", step_name, booking_id)
    return acted


async def run_booking_maintenance_once(mailer: Mailer, gateway: PaymentGateway) -> dict[str, int]:
    """One maintenance pass; returns how many reminders, payouts and marks each step made."""

    async def remind(session: AsyncSession, booking_id: str) -> bool:
        """Completion reminder step for one booking."""
        return await service_maintenance.remind_completion(session, mailer, booking_id)

    async def release(session: AsyncSession, booking_id: str) -> bool:
        """Automatic payout step for one booking."""
        return await service_maintenance.auto_release_booking(session, mailer, gateway, booking_id)

    summary = {
        "completion_reminders": await _for_each_booking(
            "completion_reminder_sent_at", "completion reminder", remind
        ),
        "payouts_released": await _for_each_booking("payout_auto_released_at", "auto payout", release),
        "stale_enquiries": 0,
        "enquiry_reminders": 0,
    }
    try:
        async with job_session() as session:
            summary["stale_enquiries"] = await service_maintenance.mark_stale_enquiries(session)
    except Exception:
        log.exception("bookings: stale enquiry marking failed")
    try:
        async with job_session() as session:
            summary["enquiry_reminders"] = await service_maintenance.send_enquiry_reminders(session, mailer)
    except Exception:
        log.exception("bookings: vendor enquiry reminders failed")
    log.info("bookings: maintenance done %s", summary)
    return summary


def register() -> None:
    """Declare the hourly maintenance task on the worker's app."""
    jobs_app = get_jobs_app()

    @jobs_app.periodic(cron=_HOURLY_CRON, periodic_id=MAINTENANCE_TASK_NAME)
    @jobs_app.task(name=MAINTENANCE_TASK_NAME, queueing_lock=MAINTENANCE_TASK_NAME)
    async def run_booking_maintenance(timestamp: int) -> None:
        """The hourly pass with the real Stripe and Resend adapters; `timestamp` is the scheduled time."""
        log.info("bookings: maintenance starting scheduled_at=%s", timestamp)
        await run_booking_maintenance_once(ResendMailer(), StripePaymentGateway())
