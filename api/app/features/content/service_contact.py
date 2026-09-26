"""Contact form use case: a signed-in client, vendor or staff member sends the team a message.

The message is filed under a subject (picked by the AI classifier, or fixed for
staff bug reports), stored in `contact_submissions`, emailed to staff and, for
bug, booking and payment subjects, forwarded to the Cursor automation webhook.
"""

from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.ports import LanguageModel, Mailer, WebhookCall, Webhooks
from app.core.settings import get_settings
from app.features.content import repository
from app.features.content.domain_contact import (
    ADMIN_BUG_REPORT_SUBJECT,
    AUTOMATION_SUBJECTS,
    CLASSIFIER_MODEL,
    FALLBACK_SUBJECT,
    SUBJECT_LABELS,
    ContactClassification,
    ContactSubject,
    automation_payload,
    booking_reference,
    classifier_messages,
    clean_message,
)
from app.features.content.errors import BookingNotFound, BookingNotOnAccount
from app.features.notifications import service as notifications_service

log = get_logger(__name__)


async def classify(language_model: LanguageModel, *, portal: str, message: str) -> ContactSubject:
    """The subject the model picks for a message; `other` when the model is off or fails."""
    try:
        # The model call blocks; a worker thread keeps the event loop serving others.
        classification = await asyncio.to_thread(
            language_model.parse,
            model=CLASSIFIER_MODEL,
            messages=classifier_messages(portal=portal, message=message),
            reply_model=ContactClassification,
            purpose="contact_classify",
        )
    except Exception as error:
        log.warning("contact_classify: failed portal=%s err=%s - using %s", portal, error, FALLBACK_SUBJECT)
        return FALLBACK_SUBJECT
    log.info("contact_classify: portal=%s subject=%s", portal, classification.subject)
    return classification.subject


async def _check_booking_belongs_to(
    session: AsyncSession, principal: Principal, portal: str, booking_id: str
) -> None:
    """Refuse a booking reference that does not exist or is not the caller's on this portal."""
    booking = await repository.find_booking_parties(session, booking_id)
    if booking is None:
        raise BookingNotFound()
    if portal == "client" and booking.client_user_id != principal.id:
        raise BookingNotOnAccount()
    if portal == "vendor" and booking.vendor_user_id != principal.id:
        raise BookingNotOnAccount()


def _forward_to_automation(webhooks: Webhooks, payload: dict[str, Any]) -> None:
    """Queue the Cursor automation webhook when it is configured (skipped otherwise)."""
    settings = get_settings()
    url = settings.cursor_automation_webhook_url.strip()
    if not url:
        log.info("cursor webhook skipped (URL unset) submission_id=%s", payload["submission_id"])
        return
    headers = {"Content-Type": "application/json"}
    secret = settings.cursor_automation_webhook_secret.strip()
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    webhooks.post_in_background(WebhookCall(url=url, payload=payload, headers=headers))


async def _file_message(
    session: AsyncSession,
    principal: Principal,
    *,
    portal: str,
    body: str,
    booking_id: str | None,
    subject: ContactSubject,
    mailer: Mailer,
    webhooks: Webhooks,
) -> None:
    """Store a checked message, forward triage-worthy subjects, and email staff (neither can fail it)."""
    subject_label = SUBJECT_LABELS[subject]
    submission_id = await repository.insert_contact_submission(
        session,
        user_id=principal.id,
        portal=portal,
        subject_label=subject_label,
        message=body,
        booking_id=booking_id,
    )
    if submission_id is None:
        log.warning("contact_submissions insert returned no row user=%s", principal.id)
    user_email = principal.email or None
    if subject in AUTOMATION_SUBJECTS:
        payload = automation_payload(
            submission_id=submission_id,
            portal=portal,
            user_id=principal.id,
            user_email=user_email,
            subject=subject,
            message=body,
            booking_id=booking_id,
        )
        _forward_to_automation(webhooks, payload)
    notifications_service.send_contact_submitted_alert(
        mailer,
        portal=portal,
        user_email=user_email,
        subject_label=subject_label,
        message=body,
        booking_id=booking_id,
    )


async def submit_portal_message(
    session: AsyncSession,
    principal: Principal,
    *,
    portal: str,
    message: str,
    raw_booking_id: str | None,
    language_model: LanguageModel,
    mailer: Mailer,
    webhooks: Webhooks,
) -> None:
    """A client's or vendor's message (`portal` is theirs), optionally about one of their bookings.

    The booking reference is checked before the classifier runs, so a mistyped
    reference costs no model call.
    """
    body = clean_message(message)
    booking_id = booking_reference(raw_booking_id)
    if booking_id:
        await _check_booking_belongs_to(session, principal, portal, booking_id)
    subject = await classify(language_model, portal=portal, message=body)
    await _file_message(
        session,
        principal,
        portal=portal,
        body=body,
        booking_id=booking_id,
        subject=subject,
        mailer=mailer,
        webhooks=webhooks,
    )


async def submit_bug_report(
    session: AsyncSession, principal: Principal, *, message: str, mailer: Mailer, webhooks: Webhooks
) -> None:
    """A staff bug report from the admin console: always filed as a bug report, never classified."""
    body = clean_message(message)
    await _file_message(
        session,
        principal,
        portal="admin",
        body=body,
        booking_id=None,
        subject=ADMIN_BUG_REPORT_SUBJECT,
        mailer=mailer,
        webhooks=webhooks,
    )
