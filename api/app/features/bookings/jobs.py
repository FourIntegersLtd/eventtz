"""The hourly booking maintenance, run by the procrastinate worker (ADR 0008).

Replaces the baseline's in-process scheduler. Each hour, in the baseline's order:
completion reminders, automatic vendor payouts, stale-enquiry marking, vendor
enquiry reminders, the client's no-response nudge, event-tomorrow reminders,
pay-to-confirm reminders, the vendor payouts-setup nudge and the choose-a-cancellation-policy
nudge. Each booking that may move money gets its own
transaction, so one failure never undoes another booking's payout.

`run_booking_maintenance_once` holds the work and takes its adapters as arguments,
so tests call it with fakes; the registered task only plugs in the real adapters.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.openai_language_model import OpenAILanguageModel
from app.adapters.resend_mailer import ResendMailer
from app.adapters.stripe_payments import StripePaymentGateway
from app.core.db import job_session
from app.core.jobs import get_jobs_app
from app.core.logging import get_logger
from app.core.mail import AfterCommitMailer
from app.core.ports import LanguageModel, Mailer, PaymentGateway
from app.features.bookings import service_deposits, service_maintenance, service_reminders
from app.features.notifications import service_terms_notice

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


async def run_booking_maintenance_once(
    mailer: Mailer, gateway: PaymentGateway, language_model: LanguageModel
) -> dict[str, int]:
    """One maintenance pass; returns how many reminders, payouts and marks each step made.

    `language_model` reads the client's search text when choosing alternative vendors.
    Each step gets `mailer` wrapped in an `AfterCommitMailer` on its own session, so
    a reminder's email goes out only once its claimed marker has committed.
    """

    async def remind(session: AsyncSession, booking_id: str) -> bool:
        """Completion reminder step for one booking."""
        return await service_maintenance.remind_completion(
            session, AfterCommitMailer(session, mailer), booking_id
        )

    async def release(session: AsyncSession, booking_id: str) -> bool:
        """Automatic payout step for one booking."""
        return await service_maintenance.auto_release_booking(
            session, AfterCommitMailer(session, mailer), gateway, booking_id
        )

    summary = {
        "completion_reminders": await _for_each_booking(
            "completion_reminder_sent_at", "completion reminder", remind
        ),
        "payouts_released": await _for_each_booking("payout_auto_released_at", "auto payout", release),
        "stale_enquiries": 0,
        "enquiry_reminders": 0,
        "client_nudges": 0,
        "event_tomorrow": 0,
        "pay_to_confirm": 0,
        "payouts_setup": 0,
        "cancellation_policy": 0,
        "cancellation_policy_reminder": 0,
        "terms_notices": 0,
        "final_payouts": 0,
        "unpaid_expired": 0,
        "deposits_refunded": 0,
    }
    now = datetime.now(UTC)
    # Every remaining step opens its own transaction and logs its own failure, so one
    # broken reminder never stops the others.
    steps: list[tuple[str, str, Callable[[AsyncSession], Awaitable[int]]]] = [
        ("stale_enquiries", "stale enquiry marking", service_maintenance.mark_stale_enquiries),
        (
            "enquiry_reminders",
            "vendor enquiry reminders",
            lambda session: service_maintenance.send_enquiry_reminders(
                session, AfterCommitMailer(session, mailer)
            ),
        ),
        (
            "client_nudges",
            "client no-response nudges",
            lambda session: service_reminders.send_client_no_response_nudges(
                session, AfterCommitMailer(session, mailer), language_model, now=now
            ),
        ),
        (
            "event_tomorrow",
            "event-tomorrow reminders",
            lambda session: service_reminders.send_event_tomorrow_reminders(
                session, AfterCommitMailer(session, mailer), now=now
            ),
        ),
        (
            "pay_to_confirm",
            "pay-to-confirm reminders",
            lambda session: service_reminders.send_pay_to_confirm_reminders(
                session, AfterCommitMailer(session, mailer), now=now
            ),
        ),
        (
            "payouts_setup",
            "payouts-setup nudges",
            lambda session: service_reminders.send_payouts_setup_nudges(
                session, AfterCommitMailer(session, mailer), now=now
            ),
        ),
        (
            "cancellation_policy",
            "cancellation-policy nudges",
            lambda session: service_reminders.send_cancellation_policy_nudges(
                session, AfterCommitMailer(session, mailer)
            ),
        ),
        (
            "cancellation_policy_reminder",
            "cancellation-policy reminders",
            lambda session: service_reminders.send_cancellation_policy_reminders(
                session, AfterCommitMailer(session, mailer), now=now
            ),
        ),
        (
            "terms_notices",
            "terms-updated notices",
            lambda session: service_terms_notice.send_terms_updated_notices(
                session, AfterCommitMailer(session, mailer)
            ),
        ),
        (
            "final_payouts",
            "split payout final parts",
            lambda session: service_maintenance.release_final_payouts(
                session, AfterCommitMailer(session, mailer), gateway
            ),
        ),
        (
            "unpaid_expired",
            "unpaid booking expiry",
            lambda session: service_maintenance.expire_unpaid_bookings(
                session, AfterCommitMailer(session, mailer), gateway
            ),
        ),
        (
            "deposits_refunded",
            "deposit refunds",
            lambda session: service_deposits.refund_due_deposits(
                session, AfterCommitMailer(session, mailer), gateway
            ),
        ),
    ]
    for summary_key, step_name, run_step in steps:
        try:
            async with job_session() as session:
                summary[summary_key] = await run_step(session)
        except Exception:
            log.exception("bookings: %s failed", step_name)
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
        await run_booking_maintenance_once(ResendMailer(), StripePaymentGateway(), OpenAILanguageModel())
