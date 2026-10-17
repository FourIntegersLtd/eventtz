"""The four reminders the hourly job sends besides the post-event ones.

Ported from the baseline's `enquiry_reminders.py` and `lifecycle_reminders.py`:

- the client is nudged 24 hours after an enquiry the vendor never answered, with other vendors to try;
- the client is reminded to pay 24 hours after the vendor accepted;
- both sides are reminded the day before a paid event (UTC calendar day);
- an approved vendor without ready payouts is nudged 24 hours after approval.

Each reminder is claimed by its marker column with a conditional write BEFORE anything is
sent, so two overlapping runs cannot both send it. Each one runs in its own savepoint: a
database error undoes that reminder's claim only, and it is tried again next hour.
A closed account gets nothing; its marker is still set so it is not looked at again.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import LanguageModel, Mailer
from app.core.site import public_url
from app.features.bookings import domain, domain_maintenance, repository, repository_maintenance
from app.features.bookings.rows import BookingRow, SilentEnquiryRow
from app.features.identity import service as identity
from app.features.marketplace import service_alternatives, service_explore
from app.features.marketplace import service_events as events
from app.features.notifications import service as notification_emails
from app.features.notifications import service_booking as notices
from app.features.vendors import service_payouts_nudge

log = get_logger(__name__)

# What the client sees when the quiet vendor's profile can no longer be read.
_QUIET_VENDOR_FALLBACK = "the vendor"
_NO_EVENT_NAME = "your event"


def _has_address(address: str | None) -> bool:
    """True for something that looks like an email address."""
    return bool(address) and "@" in (address or "")


# --- client: the vendor has not replied -------------------------------------------------------------


async def _nudge_client(
    session: AsyncSession,
    mailer: Mailer,
    language_model: LanguageModel,
    enquiry: SilentEnquiryRow,
    *,
    client_gone: bool,
    client_email: str | None,
) -> bool:
    """Nudge one client; True when the nudge was claimed and the client is still on the platform."""
    claimed = await repository.update_booking(
        session,
        enquiry.id,
        {},
        status_in=("pending",),
        unset_column="client_no_response_nudge_at",
        now_columns=("client_no_response_nudge_at",),
    )
    if not claimed or client_gone:
        return False
    vendor_payload = await service_explore.bookable_vendor_payload(
        session, enquiry.vendor_user_id, viewer=None
    )
    typed_name = vendor_payload.get("businessName") if vendor_payload else None
    vendor_name = (
        typed_name.strip() if isinstance(typed_name, str) and typed_name.strip() else _QUIET_VENDOR_FALLBACK
    )
    already_asked = await repository_maintenance.vendor_ids_contacted_by(
        session, enquiry.client_user_id, limit=domain_maintenance.CONTACTED_VENDORS_LOOKUP_LIMIT
    )
    alternatives = await service_alternatives.alternative_vendors(
        session,
        search_context=enquiry.client_search_context,
        silent_vendor_payload=vendor_payload,
        exclude_vendor_ids={*already_asked, enquiry.vendor_user_id},
        language_model=language_model,
    )
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=enquiry.client_user_id,
        booking_id=enquiry.id,
        kind="client_vendor_no_response",
        mode="insert_if_absent",
        portal="client",
        event_name=enquiry.event_name or None,
        # The email below replaces the stock one, which would also use up this booking's one send.
        send_email=False,
    )
    if client_email and _has_address(client_email):
        await notices.send_client_vendor_no_response_email(
            session,
            mailer,
            to_email=client_email.strip(),
            user_id=enquiry.client_user_id,
            booking_id=enquiry.id,
            vendor_name=vendor_name,
            event_name=enquiry.event_name.strip() or _NO_EVENT_NAME,
            alternatives=[
                notices.AlternativeVendorLine(
                    name=alternative.name,
                    href=public_url(f"/client/browse/{alternative.user_id}"),
                    reply=alternative.reply,
                )
                for alternative in alternatives
            ],
        )
    await events.record_marketplace_event(
        session,
        "enquiry_client_no_response_nudge",
        actor_user_id=enquiry.client_user_id,
        vendor_user_id=enquiry.vendor_user_id,
        booking_request_id=enquiry.id,
        payload={"alternatives": len(alternatives)},
    )
    return True


async def send_client_no_response_nudges(
    session: AsyncSession, mailer: Mailer, language_model: LanguageModel, *, now: datetime
) -> int:
    """Nudge clients whose enquiry has gone 24 hours without a vendor reply; returns how many were nudged."""
    enquiries = await repository_maintenance.silent_client_enquiries(
        session,
        created_before=now - domain_maintenance.CLIENT_NUDGE_AFTER,
        limit=domain_maintenance.ENQUIRY_REMINDER_BATCH_LIMIT,
    )
    contacts = await identity.contact_emails(session, [enquiry.client_user_id for enquiry in enquiries])
    nudged = 0
    for enquiry in enquiries:
        try:
            async with repository_maintenance.reminder_savepoint(session):
                if await _nudge_client(
                    session,
                    mailer,
                    language_model,
                    enquiry,
                    client_gone=enquiry.client_user_id in contacts
                    and contacts[enquiry.client_user_id] is None,
                    client_email=contacts.get(enquiry.client_user_id),
                ):
                    nudged += 1
        except Exception:
            # One bad enquiry must not stop the rest; it is retried next hour.
            log.exception("bookings: client no-response nudge failed booking=%s", enquiry.id)
    return nudged


# --- client: pay to confirm ---------------------------------------------------------------------------


async def send_pay_to_confirm_reminders(session: AsyncSession, mailer: Mailer, *, now: datetime) -> int:
    """Remind clients to pay a booking the vendor accepted 24 hours ago, unless the event is over."""
    limit = domain_maintenance.MAINTENANCE_BATCH_LIMIT
    candidates = await repository_maintenance.unpaid_accepted_bookings(
        session, accepted_before=now - domain_maintenance.PAY_TO_CONFIRM_AFTER, limit=limit * 3
    )
    contacts = await identity.contact_emails(session, [booking.client_user_id for booking in candidates])
    reminded = 0
    for booking in candidates:
        if reminded >= limit:
            break
        if domain.event_day_over(booking, now):
            continue
        try:
            async with repository_maintenance.reminder_savepoint(session):
                if await _remind_to_pay(
                    session, mailer, booking, client_gone=_is_gone(contacts, booking.client_user_id)
                ):
                    reminded += 1
        except Exception:
            log.exception("bookings: pay-to-confirm reminder failed booking=%s", booking.id)
    return reminded


def _is_gone(contacts: dict[str, str | None], user_id: str) -> bool:
    """True when the account exists but was closed (a closed account has no contact email)."""
    return user_id in contacts and contacts[user_id] is None


async def _remind_to_pay(
    session: AsyncSession, mailer: Mailer, booking: BookingRow, *, client_gone: bool
) -> bool:
    """Claim and send one pay-to-confirm reminder; True when the client was reminded."""
    claimed = await repository.update_booking(
        session,
        booking.id,
        {},
        status_in=("accepted",),
        payment_status_in=("unpaid",),
        unset_column="pay_to_confirm_reminded_at",
        now_columns=("pay_to_confirm_reminded_at",),
    )
    if not claimed or client_gone:
        return False
    await notices.dispatch_booking_notification(
        session,
        mailer,
        user_id=booking.client_user_id,
        booking_id=booking.id,
        kind="pay_to_confirm",
        mode="insert_if_absent",
        portal="client",
        event_name=booking.event_name or None,
    )
    return True


# --- both sides: the event is tomorrow ------------------------------------------------------------------


async def send_event_tomorrow_reminders(session: AsyncSession, mailer: Mailer, *, now: datetime) -> int:
    """Tell both sides of each paid booking whose event starts tomorrow (UTC); returns how many bookings."""
    limit = domain_maintenance.MAINTENANCE_BATCH_LIMIT
    candidates = await repository_maintenance.paid_bookings_starting_on(
        session, domain_maintenance.tomorrow_utc(now), limit=limit * 3
    )
    contacts = await identity.contact_emails(
        session,
        [user_id for booking in candidates for user_id in (booking.client_user_id, booking.vendor_user_id)],
    )
    reminded = 0
    for booking in candidates:
        if reminded >= limit:
            break
        if domain.event_day_over(booking, now):
            continue
        try:
            async with repository_maintenance.reminder_savepoint(session):
                if await _remind_event_tomorrow(session, mailer, booking, contacts):
                    reminded += 1
        except Exception:
            log.exception("bookings: event-tomorrow reminder failed booking=%s", booking.id)
    return reminded


async def _remind_event_tomorrow(
    session: AsyncSession, mailer: Mailer, booking: BookingRow, contacts: dict[str, str | None]
) -> bool:
    """Claim and send one booking's day-before reminders to whichever sides still have an account."""
    claimed = await repository.update_booking(
        session,
        booking.id,
        {},
        status_in=("accepted",),
        payment_status_in=("paid",),
        unset_column="event_tomorrow_reminded_at",
        now_columns=("event_tomorrow_reminded_at",),
    )
    if not claimed:
        return False
    if not _is_gone(contacts, booking.client_user_id):
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.client_user_id,
            booking_id=booking.id,
            kind="event_tomorrow",
            mode="insert_if_absent",
            portal="client",
            event_name=booking.event_name or None,
        )
    if not _is_gone(contacts, booking.vendor_user_id):
        await notices.dispatch_booking_notification(
            session,
            mailer,
            user_id=booking.vendor_user_id,
            booking_id=booking.id,
            kind="vendor_event_tomorrow",
            mode="insert_if_absent",
            portal="vendor",
            event_name=booking.event_name or None,
        )
    return True


# --- vendor: set up payouts -----------------------------------------------------------------------------


async def send_payouts_setup_nudges(session: AsyncSession, mailer: Mailer, *, now: datetime) -> int:
    """Email approved vendors without ready payouts, 24 hours after approval; returns how many were sent."""
    limit = domain_maintenance.MAINTENANCE_BATCH_LIMIT
    vendors = await service_payouts_nudge.vendors_awaiting_payouts_nudge(session, now=now, limit=limit * 3)
    contacts = await identity.contact_emails(session, [vendor.user_id for vendor in vendors])
    sent = 0
    for vendor in vendors:
        if sent >= limit:
            break
        email = contacts.get(vendor.user_id)
        gone = _is_gone(contacts, vendor.user_id)
        if not gone and not _has_address(email):
            # No address yet: leave the nudge unclaimed so it goes out once there is one.
            continue
        try:
            async with repository_maintenance.reminder_savepoint(session):
                if not await service_payouts_nudge.claim_payouts_nudge(session, vendor.user_id) or gone:
                    continue
                if notification_emails.send_vendor_payout_nudge(
                    mailer,
                    vendor_email=email,
                    business_name=service_payouts_nudge.nudge_business_name(vendor),
                ):
                    sent += 1
        except Exception:
            log.exception("bookings: payouts-setup nudge failed vendor=%s", vendor.user_id)
    return sent


# --- vendor: upload or renew public liability insurance -----------------------------------------------


def _day_label(day: date) -> str:
    """A date as the emails write it: 1 December 2026."""
    return f"{day.day} {day:%B %Y}"


async def send_insurance_reminders(session: AsyncSession, mailer: Mailer, *, now: datetime) -> int:
    """Email approved vendors who need cover and have none checked, or whose cover ends within 30 days.

    One email per checked certificate: staff checking a new one starts the next cycle.
    Not in the hourly job yet: it goes on once the owner approves the email (no unapproved sends).
    Returns how many were sent.
    """
    limit = domain_maintenance.MAINTENANCE_BATCH_LIMIT
    today = now.date()
    vendors = await service_payouts_nudge.vendors_awaiting_insurance_reminder(
        session, today=today, limit=limit * 3
    )
    contacts = await identity.contact_emails(session, [vendor.user_id for vendor in vendors])
    sent = 0
    for vendor in vendors:
        if sent >= limit:
            break
        email = contacts.get(vendor.user_id)
        gone = _is_gone(contacts, vendor.user_id)
        if not gone and not _has_address(email):
            # No address yet: leave the reminder unclaimed so it goes out once there is one.
            continue
        cover = service_payouts_nudge.vendor_insurance(vendor, today=today)
        hidden_from = cover.listing_hidden_from or today
        try:
            async with repository_maintenance.reminder_savepoint(session):
                if not await service_payouts_nudge.claim_insurance_reminder(session, vendor.user_id) or gone:
                    continue
                if notification_emails.send_vendor_insurance_reminder(
                    mailer,
                    vendor_email=email,
                    business_name=service_payouts_nudge.nudge_business_name(vendor),
                    expires_on_label=_day_label(cover.expires_on) if cover.expires_on else None,
                    hidden_from_label=_day_label(hidden_from),
                    already_hidden=hidden_from <= today,
                ):
                    sent += 1
        except Exception:
            log.exception("bookings: insurance reminder failed vendor=%s", vendor.user_id)
    return sent
