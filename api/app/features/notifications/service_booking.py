"""Booking notices: the in-app notice plus the matching email to the client or vendor.

Other slices (bookings, payments, disputes) call `dispatch_booking_notification`
whenever a booking changes in a way a party should hear about.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import publish_after_commit, user_topic
from app.core.logging import get_logger
from app.core.ports import Mailer, OutgoingEmail
from app.core.site import public_url
from app.features.identity import service as identity
from app.features.notifications import repository, repository_bookings
from app.features.notifications.domain import APP_NAME
from app.features.notifications.domain_account_emails import TransactionalEmail
from app.features.notifications.domain_booking_copy import (
    EMAIL_DEDUPE_KINDS,
    Portal,
    booking_email_template_id,
    booking_portal_path,
    format_booking_notification,
)
from app.features.notifications.domain_booking_emails import (
    AlternativeVendorLine as AlternativeVendorLine,  # re-exported for the bookings slice
)
from app.features.notifications.domain_booking_emails import (
    client_vendor_no_response_email,
)
from app.features.notifications.rows import BookingPartiesRow
from app.features.notifications.service import render_booking_notification
from app.features.notifications.service_feed import BOOKING_NOTIFICATIONS_CHANGED

log = get_logger(__name__)

# "upsert" replaces an existing notice of the same kind; "insert_if_absent" keeps the first one.
NotifyMode = Literal["upsert", "insert_if_absent"]


def _portal_for_user(user_id: str, parties: BookingPartiesRow) -> Portal | None:
    """Which side of the booking `user_id` is on, or None when they are on neither."""
    if user_id == parties.client_user_id:
        return "client"
    if user_id == parties.vendor_user_id:
        return "vendor"
    return None


async def dispatch_booking_notification(
    session: AsyncSession,
    mailer: Mailer,
    *,
    user_id: str,
    booking_id: str,
    kind: str,
    body: str | None = None,
    mode: NotifyMode = "upsert",
    portal: Portal | None = None,
    event_name: str | None = None,
    send_email: bool = True,
) -> None:
    """Store the in-app notice for `user_id`, then email them about it.

    The email is skipped (never an error) when the person is not on the booking,
    has no usable address, or already had this lifecycle email for this booking.
    """
    if mode == "insert_if_absent":
        changed = await repository.insert_notification_if_absent(
            session, user_id=user_id, booking_id=booking_id, kind=kind
        )
    else:
        changed = await repository.replace_notification(
            session, user_id=user_id, booking_id=booking_id, kind=kind, body=body
        )
    if not changed:
        return
    publish_after_commit(session, user_topic(user_id), BOOKING_NOTIFICATIONS_CHANGED)
    if not send_email:
        return

    parties = await repository_bookings.booking_parties(session, booking_id)
    if parties is None:
        return
    resolved_portal = portal or _portal_for_user(user_id, parties)
    if resolved_portal is None:
        log.info("booking notice email skipped, user not on booking user=%s booking=%s", user_id, booking_id)
        return
    email = ((await identity.emails_by_id(session, [user_id])).get(user_id) or "").strip()
    if "@" not in email:
        log.info(
            "booking notice email skipped, no address user=%s booking=%s kind=%s", user_id, booking_id, kind
        )
        return

    headline, email_body = format_booking_notification(
        kind=kind,
        portal=resolved_portal,
        event_name=event_name or parties.event_name,
        stored_body=body,
    )
    if kind in EMAIL_DEDUPE_KINDS and not await repository.claim_email_delivery(
        session,
        template_id=booking_email_template_id(kind),
        recipient_email=email,
        recipient_user_id=user_id,
        booking_id=booking_id,
    ):
        return
    outgoing = render_booking_notification(
        email,
        TransactionalEmail(
            subject=f"{headline} | {APP_NAME}",
            title=headline,
            headline=headline,
            body=email_body,
            action_url=public_url(booking_portal_path(resolved_portal, booking_id)),
            action_label="View booking",
        ),
    )
    _send(mailer, outgoing, kind=kind, booking_id=booking_id)


def _send(mailer: Mailer, outgoing: OutgoingEmail, *, kind: str, booking_id: str) -> None:
    """Hand the email to the mailer, logging (never raising) when it is refused."""
    if not mailer.send(outgoing):
        log.warning("booking email failed kind=%s booking=%s", kind, booking_id)


async def send_client_vendor_no_response_email(
    session: AsyncSession,
    mailer: Mailer,
    *,
    to_email: str,
    user_id: str,
    booking_id: str,
    vendor_name: str,
    event_name: str,
    alternatives: list[AlternativeVendorLine],
) -> bool:
    """Email the client that their vendor is silent, listing other vendors; once per booking.

    The send is claimed in `email_delivery_log` first, so a rerun never sends it twice.
    Returns whether the mailer accepted it.
    """
    if not await repository.claim_email_delivery(
        session,
        template_id=booking_email_template_id("client_vendor_no_response"),
        recipient_email=to_email,
        recipient_user_id=user_id,
        booking_id=booking_id,
    ):
        return False
    content = client_vendor_no_response_email(
        vendor_name=vendor_name,
        event_name=event_name,
        alternatives=alternatives,
        booking_url=public_url(booking_portal_path("client", booking_id)),
        browse_url=public_url("/client/browse"),
    )
    outgoing = render_booking_notification(to_email, content)
    _send(mailer, outgoing, kind="client_vendor_no_response", booking_id=booking_id)
    return True
