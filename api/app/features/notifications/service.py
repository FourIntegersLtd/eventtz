"""Send notifications. Other slices call these; the `Mailer` port does the delivery."""

from __future__ import annotations

from app.core.logging import get_logger
from app.core.ports import Mailer, OutgoingEmail
from app.core.settings import get_settings
from app.features.notifications.domain import AdminAlert, admin_alert_context, contact_submitted_alert
from app.features.notifications.rendering import render_template

log = get_logger(__name__)


def render_admin_alert(alert: AdminAlert) -> OutgoingEmail:
    """Render an alert into an email addressed to the configured staff inboxes."""
    context = admin_alert_context(alert)
    return OutgoingEmail(
        to=tuple(get_settings().admin_alert_emails_list),
        subject=alert.subject,
        html=render_template("admin/alert.html", context),
        text=render_template("admin/alert.txt", context),
    )


def send_admin_alert(mailer: Mailer, alert: AdminAlert) -> bool:
    """Email `alert` to staff. False (never an error) if it could not be rendered or sent."""
    try:
        email = render_admin_alert(alert)
    except Exception:
        log.exception("admin alert could not be rendered template_id=%s", alert.template_id)
        return False
    return mailer.send(email)


def send_contact_submitted_alert(
    mailer: Mailer,
    *,
    portal: str,
    user_email: str | None,
    subject_label: str,
    message: str,
    booking_id: str | None,
) -> bool:
    """Tell staff a contact form was submitted (who, which portal, the message, any booking)."""
    alert = contact_submitted_alert(
        portal=portal,
        user_email=user_email,
        subject_label=subject_label,
        message=message,
        booking_id=booking_id,
    )
    return send_admin_alert(mailer, alert)
