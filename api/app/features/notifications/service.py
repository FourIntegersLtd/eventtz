"""Send notifications. Other slices call these; the `Mailer` port does the delivery."""

from __future__ import annotations

from typing import Literal

from app.core.logging import get_logger
from app.core.ports import Mailer, OutgoingEmail
from app.core.settings import get_settings
from app.features.notifications.domain import (
    APP_NAME,
    AdminAlert,
    admin_alert_context,
    contact_submitted_alert,
)
from app.features.notifications.domain_account_emails import (
    TransactionalEmail,
    admin_welcome_email,
    email_verification_email,
    password_changed_email,
    password_reset_email,
    support_message_email,
    team_invite_email,
    transactional_context,
    welcome_context,
    welcome_email,
)
from app.features.notifications.domain_vendor_emails import (
    vendor_approval_status_email,
    vendor_complete_profile_nudge_email,
    vendor_returned_for_edits_email,
    vendor_setup_payouts_nudge_email,
    vendor_submitted_alert,
)
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


def _render_transactional(email: str, content: TransactionalEmail) -> OutgoingEmail:
    """Render a `TransactionalEmail` with the shared auth layout (`auth/password_reset.html`).

    Verification, password reset and "password changed" all use this one layout
    in the baseline, so the rendering is shared here too.
    """
    context = transactional_context(content)
    return OutgoingEmail(
        to=(email,),
        subject=content.subject,
        html=render_template("auth/password_reset.html", context),
        text=render_template("auth/password_reset.txt", context),
    )


def render_booking_notification(email: str, content: TransactionalEmail) -> OutgoingEmail:
    """Render a `TransactionalEmail` with the booking layout (`booking/notification.html`).

    The baseline renders the admin welcome email with this layout, not the auth
    one, even though the two templates look alike.
    """
    context = transactional_context(content)
    return OutgoingEmail(
        to=(email,),
        subject=content.subject,
        html=render_template("booking/notification.html", context),
        text=render_template("booking/notification.txt", context),
    )


def render_email_verification(
    *, email: str, verify_url: str, expires_minutes: int = 60, user_type: str | None = None
) -> OutgoingEmail:
    """Render "verify your email" for `email`, without sending it."""
    content = email_verification_email(
        verify_url=verify_url, expires_minutes=expires_minutes, user_type=user_type
    )
    return _render_transactional(email, content)


def send_email_verification(
    mailer: Mailer,
    *,
    email: str,
    verify_url: str,
    expires_minutes: int = 60,
    user_type: str | None = None,
) -> bool:
    """Email `email` a link to verify their address. False for an invalid address, never raises."""
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized or not verify_url.strip():
        return False
    try:
        outgoing = render_email_verification(
            email=normalized, verify_url=verify_url, expires_minutes=expires_minutes, user_type=user_type
        )
        return mailer.send(outgoing)
    except Exception:
        log.exception("email verification could not be sent email=%s", normalized)
        return False


def render_password_reset(
    *,
    email: str,
    reset_url: str,
    expires_minutes: int = 60,
    user_type: str | None = None,
    purpose: Literal["reset", "setup"] = "reset",
) -> OutgoingEmail:
    """Render a password reset (or admin password setup) link for `email`, without sending it."""
    content = password_reset_email(
        reset_url=reset_url, expires_minutes=expires_minutes, user_type=user_type, purpose=purpose
    )
    return _render_transactional(email, content)


def send_password_reset(
    mailer: Mailer,
    *,
    email: str,
    reset_url: str,
    expires_minutes: int = 60,
    user_type: str | None = None,
    purpose: Literal["reset", "setup"] = "reset",
) -> bool:
    """Email `email` a password reset (or admin setup) link. False for an invalid address, never raises."""
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized or not reset_url.strip():
        return False
    try:
        outgoing = render_password_reset(
            email=normalized,
            reset_url=reset_url,
            expires_minutes=expires_minutes,
            user_type=user_type,
            purpose=purpose,
        )
        return mailer.send(outgoing)
    except Exception:
        log.exception("password reset could not be sent email=%s", normalized)
        return False


def render_password_changed(*, email: str, user_type: str | None = None) -> OutgoingEmail:
    """Render the "your password was changed" security notice for `email`, without sending it."""
    content = password_changed_email(user_type=user_type)
    return _render_transactional(email, content)


def send_password_changed(mailer: Mailer, *, email: str, user_type: str | None = None) -> bool:
    """Email `email` that their password changed. False for an invalid address, never raises."""
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    try:
        outgoing = render_password_changed(email=normalized, user_type=user_type)
        return mailer.send(outgoing)
    except Exception:
        log.exception("password changed notice could not be sent email=%s", normalized)
        return False


def render_welcome(*, email: str, user_type: str) -> OutgoingEmail:
    """Render the welcome email for `email`. Raises `ValueError` for any `user_type` but the three below."""
    if user_type == "admin":
        return render_booking_notification(email, admin_welcome_email())
    if user_type == "vendor":
        welcome = welcome_email(email=email, user_type="vendor")
    elif user_type == "client":
        welcome = welcome_email(email=email, user_type="client")
    else:
        raise ValueError(f"unsupported welcome user_type: {user_type!r}")
    context = welcome_context(welcome)
    return OutgoingEmail(
        to=(email,),
        subject=f"Welcome to {APP_NAME}",
        html=render_template("marketing/welcome.html", context),
        text=render_template("marketing/welcome.txt", context),
    )


def send_welcome(mailer: Mailer, *, email: str, user_type: str) -> bool:
    """Email `email` the client/vendor/admin welcome. False for an invalid address or user type."""
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    if user_type not in {"client", "vendor", "admin"}:
        return False
    try:
        outgoing = render_welcome(email=normalized, user_type=user_type)
        return mailer.send(outgoing)
    except Exception:
        log.exception("welcome email could not be sent email=%s user_type=%s", normalized, user_type)
        return False


def send_team_invite(mailer: Mailer, *, email: str) -> bool:
    """Email `email` the admin team invite. False for an invalid address or a failed send."""
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    try:
        return mailer.send(render_booking_notification(normalized, team_invite_email()))
    except Exception:
        log.exception("admin team invite could not be sent email=%s", normalized)
        return False


# --- vendor moderation emails ----------------------------------------------------------------


def render_vendor_submitted_alert(
    *, vendor_user_id: str, vendor_email: str | None, business_name: str | None
) -> OutgoingEmail:
    """Render the staff alert for a vendor profile submission, without sending it."""
    alert = vendor_submitted_alert(
        vendor_user_id=vendor_user_id, vendor_email=vendor_email, business_name=business_name
    )
    return render_admin_alert(alert)


def send_vendor_submitted_alert(
    mailer: Mailer, *, vendor_user_id: str, vendor_email: str | None, business_name: str | None
) -> bool:
    """Tell staff a vendor submitted their profile for review. Never raises."""
    try:
        outgoing = render_vendor_submitted_alert(
            vendor_user_id=vendor_user_id, vendor_email=vendor_email, business_name=business_name
        )
        return mailer.send(outgoing)
    except Exception:
        log.exception("vendor submitted alert could not be sent vendor_user_id=%s", vendor_user_id)
        return False


def render_vendor_approval_changed(
    *,
    vendor_email: str,
    approval_status: str,
    business_name: str | None,
    listing_visible: bool = False,
    payouts_verified: bool = False,
) -> OutgoingEmail:
    """Render the approval-change email to `vendor_email` for `approval_status`, without sending it."""
    content = vendor_approval_status_email(
        approval_status=approval_status,
        business_name=business_name,
        listing_visible=listing_visible,
        payouts_verified=payouts_verified,
    )
    return render_booking_notification(vendor_email, content)


def send_vendor_approval_changed(
    mailer: Mailer,
    *,
    vendor_email: str | None,
    approval_status: str,
    business_name: str | None,
    listing_visible: bool = False,
    payouts_verified: bool = False,
) -> bool:
    """Email a vendor that an admin changed their approval status. False for a missing/invalid address."""
    if not vendor_email or "@" not in vendor_email:
        return False
    try:
        outgoing = render_vendor_approval_changed(
            vendor_email=vendor_email,
            approval_status=approval_status,
            business_name=business_name,
            listing_visible=listing_visible,
            payouts_verified=payouts_verified,
        )
        return mailer.send(outgoing)
    except Exception:
        log.exception("vendor approval email could not be sent approval_status=%s", approval_status)
        return False


def render_vendor_returned_for_edits(
    *, vendor_email: str, business_name: str | None, admin_message: str | None = None
) -> OutgoingEmail:
    """Render "returned for edits" to `vendor_email`, without sending it."""
    content = vendor_returned_for_edits_email(business_name=business_name, admin_message=admin_message)
    return render_booking_notification(vendor_email, content)


def send_vendor_returned_for_edits(
    mailer: Mailer,
    *,
    vendor_email: str | None,
    business_name: str | None,
    admin_message: str | None = None,
) -> bool:
    """Email a vendor that their profile was returned for edits. False for a missing/invalid address."""
    if not vendor_email or "@" not in vendor_email:
        return False
    try:
        outgoing = render_vendor_returned_for_edits(
            vendor_email=vendor_email, business_name=business_name, admin_message=admin_message
        )
        return mailer.send(outgoing)
    except Exception:
        log.exception("vendor returned-for-edits email could not be sent")
        return False


def render_vendor_profile_nudge(*, vendor_email: str, business_name: str | None) -> OutgoingEmail:
    """Render the draft-profile completion nudge to `vendor_email`, without sending it."""
    content = vendor_complete_profile_nudge_email(vendor_email=vendor_email, business_name=business_name)
    return render_booking_notification(vendor_email, content)


def send_vendor_profile_nudge(mailer: Mailer, *, vendor_email: str | None, business_name: str | None) -> bool:
    """Email a draft vendor to finish and submit their profile. False for a missing/invalid address."""
    if not vendor_email or "@" not in vendor_email:
        return False
    try:
        outgoing = render_vendor_profile_nudge(vendor_email=vendor_email, business_name=business_name)
        return mailer.send(outgoing)
    except Exception:
        log.exception("vendor profile nudge email could not be sent")
        return False


def render_vendor_payout_nudge(*, vendor_email: str, business_name: str | None) -> OutgoingEmail:
    """Render the payout-setup nudge to `vendor_email`, without sending it."""
    content = vendor_setup_payouts_nudge_email(vendor_email=vendor_email, business_name=business_name)
    return render_booking_notification(vendor_email, content)


def send_vendor_payout_nudge(mailer: Mailer, *, vendor_email: str | None, business_name: str | None) -> bool:
    """Email an approved vendor to finish Stripe payout setup. False for a missing/invalid address."""
    if not vendor_email or "@" not in vendor_email:
        return False
    try:
        outgoing = render_vendor_payout_nudge(vendor_email=vendor_email, business_name=business_name)
        return mailer.send(outgoing)
    except Exception:
        log.exception("vendor payout nudge email could not be sent")
        return False


def render_support_message(
    *, email: str, messages_url: str, body_html: str, body_plain: str
) -> OutgoingEmail:
    """Render "Eventtz Support sent you a message" for `email`, without sending it."""
    content = support_message_email(messages_url=messages_url, body_html=body_html, body_plain=body_plain)
    return render_booking_notification(email, content)


def send_support_message(
    mailer: Mailer, *, email: str | None, messages_url: str, body_html: str, body_plain: str
) -> bool:
    """Email a user that Eventtz Support messaged them. False for an invalid address, never raises."""
    normalized = (email or "").strip()
    if "@" not in normalized:
        return False
    try:
        outgoing = render_support_message(
            email=normalized, messages_url=messages_url, body_html=body_html, body_plain=body_plain
        )
        return mailer.send(outgoing)
    except Exception:
        log.exception("support message email could not be sent")
        return False
