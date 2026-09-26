"""After the event: remind both parties to confirm, pay the vendor when due, and nudge slow vendors.

The hourly job in `jobs.py` runs these, one booking per transaction. The same
post-event step (`run_post_event_step`) also runs when the first party confirms
and when staff press "run maintenance" on a booking, as the baseline's did.

Stripe is never called from a read path (AGENTS.md): the baseline also paid out
when a booking page was opened, which the hourly job covers instead.

A payout that fails here is logged and left for the next run. Its ops alert and the
reminder stamps are kept: these functions catch the error, so the caller's
transaction still commits.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.ports import Mailer, PaymentGateway
from app.core.settings import get_settings
from app.features.bookings import (
    domain,
    domain_maintenance,
    domain_payments,
    repository,
    repository_maintenance,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.service_common import announce_change
from app.features.bookings.service_payments import release_vendor_payout
from app.features.identity import service as identity
from app.features.marketplace import service_events as events
from app.features.notifications import service_booking as notices

log = get_logger(__name__)


def _hours_after_event() -> float:
    """How long after the event the payout is released without both confirmations."""
    return get_settings().booking_payout_auto_release_hours_after_event


# --- one booking after its event ---------------------------------------------------------------------


async def send_completion_reminder(
    session: AsyncSession, mailer: Mailer, booking: BookingRow, *, now: datetime
) -> bool:
    """Ask whoever has not confirmed yet to confirm the event went ahead; once per booking.

    The reminder is claimed (stamped) before anything is sent, so two overlapping
    runs cannot both send it. Returns whether this call sent it.
    """
    if not domain_maintenance.needs_completion_reminder(booking, now):
        return False
    claimed = await repository.update_booking(
        session,
        booking.id,
        {},
        unset_column="completion_reminder_sent_at",
        now_columns=("completion_reminder_sent_at",),
    )
    if not claimed:
        return False
    release_at = domain.payout_auto_release_at(booking, hours_after_event=_hours_after_event())
    client_body, vendor_body = domain_maintenance.completion_reminder_bodies(release_at)
    if not booking.client_completion_confirmed_at:
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.client_user_id,
            booking_id=booking.id,
            kind="completion_reminder",
            body=client_body,
        )
    if not booking.vendor_completion_confirmed_at:
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.vendor_user_id,
            booking_id=booking.id,
            kind="vendor_completion_reminder",
            body=vendor_body,
        )
    announce_change(session, booking)
    return True


async def _try_payout(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking_id: str
) -> bool:
    """Pay the vendor now; True once paid out. A refusal is logged (staff were alerted) and gives False."""
    try:
        result = await release_vendor_payout(session, mailer, gateway, booking_id=booking_id)
    except AppError as payout_error:
        log.warning("bookings: payout attempt failed booking=%s: %s", booking_id, payout_error.code)
        return False
    return result.payment_status == domain_payments.PAYOUT_RELEASED


async def retry_stuck_payout(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow
) -> bool:
    """Both parties confirmed but the vendor is still unpaid (an earlier Transfer failed): try again."""
    if not domain_maintenance.both_parties_confirmed_awaiting_payout(booking):
        return False
    return await _try_payout(session, mailer, gateway, booking.id)


async def auto_release_payout(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow, *, now: datetime
) -> bool:
    """Pay the vendor once the automatic payout date has passed without a dispute or a support hold.

    The safety net for a client who never confirms: without it the money would stay
    held forever. A vendor Stripe cannot pay yet is left for a later run.
    """
    if not domain_maintenance.auto_release_due(booking, now, hours_after_event=_hours_after_event()):
        return False
    if await repository.has_active_dispute(session, booking.id):
        return False
    if not await _try_payout(session, mailer, gateway, booking.id):
        return False
    await repository.update_booking(session, booking.id, {}, now_columns=("payout_auto_released_at",))
    log.info("bookings: payout auto-released booking=%s", booking.id)
    return True


async def run_post_event_step(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking: BookingRow
) -> bool:
    """Send the completion reminder, then pay the vendor if that is due; True when the vendor was paid."""
    now = datetime.now(UTC)
    await send_completion_reminder(session, mailer, booking, now=now)
    if domain_maintenance.both_parties_confirmed_awaiting_payout(booking):
        # A failed retry is not followed by the auto-release: it would be the same Transfer again.
        return await retry_stuck_payout(session, mailer, gateway, booking)
    return await auto_release_payout(session, mailer, gateway, booking, now=now)


# --- the hourly job's steps --------------------------------------------------------------------------


async def due_post_event_booking_ids(session: AsyncSession, *, unset_column: str) -> list[str]:
    """Paid bookings whose event is over and whose `unset_column` step has not run yet (at most 50)."""
    now = datetime.now(UTC)
    limit = domain_maintenance.MAINTENANCE_BATCH_LIMIT
    # Read more than the limit: some of the earliest may be multi-day events not over yet.
    candidates = await repository_maintenance.paid_bookings_without(session, unset_column, limit=limit * 3)
    return [booking.id for booking in candidates if domain.event_day_over(booking, now)][:limit]


async def remind_completion(session: AsyncSession, mailer: Mailer, booking_id: str) -> bool:
    """The hourly completion reminder for one booking, read afresh; True when it was sent."""
    booking = await repository.get_booking(session, booking_id)
    if booking is None:
        return False
    return await send_completion_reminder(session, mailer, booking, now=datetime.now(UTC))


async def auto_release_booking(
    session: AsyncSession, mailer: Mailer, gateway: PaymentGateway, booking_id: str
) -> bool:
    """The hourly automatic payout for one booking, read afresh; True when the vendor was paid."""
    booking = await repository.get_booking(session, booking_id)
    if booking is None:
        return False
    return await auto_release_payout(session, mailer, gateway, booking, now=datetime.now(UTC))


async def mark_stale_enquiries(session: AsyncSession) -> int:
    """Mark client enquiries left unanswered past the SLA as VENDOR_NO_RESPONSE; returns how many.

    A funnel signal for analytics only: the booking stays open, the vendor may still reply.
    """
    cutoff = domain_maintenance.stale_enquiry_cutoff(
        datetime.now(UTC), get_settings().enquiry_response_sla_hours
    )
    if cutoff is None:
        return 0
    return await repository_maintenance.mark_stale_enquiries(
        session, failure_reason=domain_maintenance.FAILURE_VENDOR_NO_RESPONSE, created_before=cutoff
    )


async def send_enquiry_reminders(session: AsyncSession, mailer: Mailer) -> int:
    """Nudge vendors 1, 6 and 24 hours after a client enquiry they have not answered; returns how many sent.

    A vendor who closed their account gets no email; their reminders are stamped
    as done so the enquiry is not looked at again.
    """
    now = datetime.now(UTC)
    enquiries = await repository_maintenance.unanswered_enquiries(
        session, limit=domain_maintenance.ENQUIRY_REMINDER_BATCH_LIMIT
    )
    vendor_emails = await identity.contact_emails(session, [enquiry.vendor_user_id for enquiry in enquiries])
    departed_vendor_ids = {vendor_id for vendor_id, email in vendor_emails.items() if email is None}
    sent = 0
    for enquiry in enquiries:
        if enquiry.vendor_user_id in departed_vendor_ids:
            await repository_maintenance.stamp_enquiry_reminders(
                session, enquiry.id, domain_maintenance.unsent_enquiry_reminder_columns(enquiry)
            )
            continue
        for stamp_column, kind, hours in domain_maintenance.enquiry_reminders_due(enquiry, now):
            await notices.dispatch_booking_notification(
                session,
                mailer,
                user_id=enquiry.vendor_user_id,
                booking_id=enquiry.id,
                kind=kind,
                mode="insert_if_absent",
                portal="vendor",
                event_name=enquiry.event_name or None,
            )
            await events.record_marketplace_event(
                session,
                "enquiry_vendor_reminded",
                vendor_user_id=enquiry.vendor_user_id,
                booking_request_id=enquiry.id,
                payload={"hours": hours, "kind": kind},
            )
            await repository_maintenance.stamp_enquiry_reminders(session, enquiry.id, [stamp_column])
            sent += 1
    return sent
