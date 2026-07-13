"""Admin alert emails."""

from __future__ import annotations

import html

from app.features.email.admin_recipients import admin_notify_recipients
from app.features.email.resend_client import send_email


def send_admin_contact_submitted_email(
    *,
    portal: str,
    user_email: str | None,
    subject: str,
    message: str,
    booking_id: str | None,
) -> bool:
    recipients = admin_notify_recipients()
    safe_subject = html.escape(subject)
    safe_message = html.escape(message)
    safe_email = html.escape(user_email or "unknown")
    safe_portal = html.escape(portal)
    booking_line = (
        f"<p><strong>Booking:</strong> {html.escape(booking_id)}</p>"
        if booking_id
        else ""
    )
    body_html = (
        f"<p><strong>Portal:</strong> {safe_portal}</p>"
        f"<p><strong>From:</strong> {safe_email}</p>"
        f"<p><strong>Subject:</strong> {safe_subject}</p>"
        f"{booking_line}"
        f"<pre style='white-space:pre-wrap;font-family:inherit'>{safe_message}</pre>"
    )
    plain = (
        f"Portal: {portal}\n"
        f"From: {user_email or 'unknown'}\n"
        f"Subject: {subject}\n"
        f"{f'Booking: {booking_id}\n' if booking_id else ''}"
        f"\n{message}"
    )
    return send_email(
        to=recipients,
        subject=f"[Eventtz contact] {subject}",
        html=body_html,
        text=plain,
    )
