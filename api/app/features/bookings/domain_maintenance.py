"""Pure rules for the hourly booking maintenance: who is reminded when, and which payouts are due.

Ported from the baseline's `payment_maintenance.py`, `completion_rules.py` and
`enquiry_reminders.py`. No I/O: the service reads the rows and passes the clock in.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.features.bookings import domain
from app.features.bookings.rows import BookingRow, EnquiryReminderRow

# How many bookings each hourly step handles at most (the baseline's limit).
MAINTENANCE_BATCH_LIMIT = 50
# How many unanswered enquiries one run looks at for vendor reminders (the baseline's limit).
ENQUIRY_REMINDER_BATCH_LIMIT = 200
# How long an unanswered enquiry waits before the client is nudged, and an unpaid accepted booking
# before its pay-to-confirm reminder.
CLIENT_NUDGE_AFTER = timedelta(hours=24)
PAY_TO_CONFIRM_AFTER = timedelta(hours=24)
# How many bookings the client's other bookings are looked through, to skip vendors they already asked.
CONTACTED_VENDORS_LOOKUP_LIMIT = 500
# A client enquiry the vendor never answered within the SLA (a funnel signal, not a decline).
FAILURE_VENDOR_NO_RESPONSE = "VENDOR_NO_RESPONSE"
# An accepted booking the client did not pay by its deadline (`domain_policy.payment_due_at`).
FAILURE_PAYMENT_DEADLINE = "PAYMENT_DEADLINE"

# The vendor's nudges about an unanswered enquiry: (stamp column, notice kind, hours after it was sent).
ENQUIRY_REMINDER_STEPS: tuple[tuple[str, str, int], ...] = (
    ("enquiry_reminder_1h_at", "enquiry_reminder_1h", 1),
    ("enquiry_reminder_6h_at", "enquiry_reminder_6h", 6),
    ("enquiry_reminder_24h_at", "enquiry_reminder_24h", 24),
)


def format_release_date(release_at: datetime) -> str:
    """The automatic payout date as the reminders print it, e.g. "Wednesday 3 June"."""
    return release_at.strftime("%A %d %B").replace(" 0", " ")


def completion_reminder_bodies(release_at: datetime | None) -> tuple[str, str]:
    """The (client, vendor) post-event reminder texts, naming the automatic payout date."""
    release_label = format_release_date(release_at) if release_at is not None else "soon"
    client_body = (
        "We hope your event went well.\n\n"
        "If everything was as expected, please confirm the booking is complete. "
        f"If something went wrong, report a problem before {release_label}, "
        "otherwise we will pay the vendor automatically."
    )
    vendor_body = (
        "Your event date has passed.\n\n"
        "Please confirm the booking is complete to receive your payout sooner. "
        f"If the client does not respond, you will be paid automatically on {release_label} "
        "unless they have reported a problem."
    )
    return client_body, vendor_body


def needs_completion_reminder(booking: BookingRow, now: datetime) -> bool:
    """True for a paid, accepted booking whose event is over and that has had no reminder yet."""
    return (
        booking.status == "accepted"
        and booking.payment_status == "paid"
        and not booking.completion_reminder_sent_at
        and domain.event_day_over(booking, now)
    )


def both_parties_confirmed_awaiting_payout(booking: BookingRow) -> bool:
    """Both sides confirmed, yet the money is still held: an earlier Transfer attempt failed."""
    return (
        booking.status == "accepted"
        and booking.payment_status == "paid"
        and bool(booking.client_completion_confirmed_at)
        and bool(booking.vendor_completion_confirmed_at)
    )


def auto_release_due(booking: BookingRow, now: datetime, *, hours_after_event: float) -> bool:
    """True once the automatic payout date has passed for a booking not yet auto-released.

    Disputes and the support hold also block the release; the service checks those,
    since a dispute is read from another table.
    """
    if booking.payout_auto_released_at or booking.support_hold:
        return False
    release_at = domain.payout_auto_release_at(booking, hours_after_event=hours_after_event)
    return release_at is not None and now >= release_at


def payout_eligible_for_staff(booking: BookingRow, now: datetime, *, hours_after_event: float) -> bool:
    """Staff may release a payout when both parties confirmed, or the automatic payout is already due."""
    both_confirmed = bool(booking.client_completion_confirmed_at and booking.vendor_completion_confirmed_at)
    release_at = domain.payout_auto_release_at(booking, hours_after_event=hours_after_event)
    auto_due = release_at is not None and domain.event_day_over(booking, now) and now >= release_at
    return both_confirmed or auto_due


def enquiry_reminders_due(enquiry: EnquiryReminderRow, now: datetime) -> list[tuple[str, str, int]]:
    """The reminder steps (column, kind, hours) whose time has come and that were not sent yet."""
    created_at = parse_timestamp(enquiry.created_at)
    if created_at is None:
        return []
    waited = now - created_at
    return [
        (stamp_column, kind, hours)
        for stamp_column, kind, hours in ENQUIRY_REMINDER_STEPS
        if not getattr(enquiry, stamp_column) and waited >= timedelta(hours=hours)
    ]


def stale_enquiry_cutoff(now: datetime, sla_hours: int) -> datetime | None:
    """The creation time before which an enquiry is past the response SLA; `None` when the SLA is off."""
    if sla_hours <= 0:
        return None
    return now - timedelta(hours=sla_hours)


def unsent_enquiry_reminder_columns(enquiry: EnquiryReminderRow) -> list[str]:
    """The reminder stamp columns still empty (stamped without sending when the vendor has left)."""
    return [
        stamp_column
        for stamp_column, _kind, _hours in ENQUIRY_REMINDER_STEPS
        if not getattr(enquiry, stamp_column)
    ]


def parse_timestamp(value: str | None) -> datetime | None:
    """An ISO timestamp as the rows carry it, or `None` when missing or unreadable."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def tomorrow_utc(now: datetime) -> date:
    """The calendar day after `now` in UTC, which is the day "event tomorrow" reminders look for."""
    return now.astimezone(UTC).date() + timedelta(days=1)
