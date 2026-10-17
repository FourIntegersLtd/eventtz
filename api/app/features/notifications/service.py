"""Send notifications. Other slices call these; the `Mailer` port does the delivery."""

from __future__ import annotations

from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer, OutgoingEmail
from app.core.settings import get_settings
from app.core.site import public_url
from app.features.identity import service as identity_service
from app.features.notifications import repository as notifications_repository
from app.features.notifications.domain import (
    APP_NAME,
    COMPANY_LEGAL_NAME,
    SUPPORT_EMAIL,
    AdminAlert,
    admin_alert_context,
    contact_submitted_alert,
    dispute_opened_alert,
    email_context,
)
from app.features.notifications.domain_account_emails import (
    TransactionalEmail,
    account_deleted_email,
    admin_welcome_email,
    client_suspended_email,
    email_verification_email,
    password_changed_email,
    password_reset_email,
    support_message_email,
    team_invite_email,
    transactional_context,
    welcome_context,
    welcome_email,
)
from app.features.notifications.domain_booking_copy import (
    booking_email_template_id,
    receipt_action_path,
    receipt_email_headlines,
)
from app.features.notifications.domain_vendor_emails import (
    vendor_approval_status_email,
    vendor_complete_profile_nudge_email,
    vendor_listing_hidden_email,
    vendor_listing_paused_email,
    vendor_returned_for_edits_email,
    vendor_setup_payouts_nudge_email,
    vendor_submitted_alert,
    vendor_warning_email,
)
from app.features.notifications.rendering import render_template

log = get_logger(__name__)


def receipt_document_branding() -> dict[str, str]:
    """Legal footer lines for server-generated receipt HTML."""
    return {"company_legal_name": COMPANY_LEGAL_NAME, "support_email": SUPPORT_EMAIL}


def render_receipt_document_html(context: dict[str, object]) -> str:
    """Render a receipt payload context to HTML (templates live in this slice)."""
    return render_template("booking/receipt_document.html", context)


_RECEIPT_HTML_TEMPLATES = {
    "payment_receipt": "booking/payment_receipt.html",
    "vendor_payment_record": "booking/vendor_payment_record.html",
    "vendor_payout_statement": "booking/vendor_payout_statement.html",
}
_RECEIPT_TEXT_TEMPLATES = {
    "payment_receipt": "booking/payment_receipt.txt",
    "vendor_payment_record": "booking/vendor_payment_record.txt",
    "vendor_payout_statement": "booking/vendor_payout_statement.txt",
}
_RECEIPT_KIND_BY_DOCUMENT = {
    "client_payment_receipt": "payment_receipt",
    "vendor_payment_record": "vendor_payment_record",
    "vendor_payout_statement": "vendor_payout_statement",
}


def render_receipt_email(
    receipt_payload: dict[str, Any], *, to_email: str, booking_id: str
) -> OutgoingEmail | None:
    """Render a receipt email for `receipt_payload`; None when the document type is unknown."""
    document_type = str(receipt_payload.get("document_type") or "")
    kind = _RECEIPT_KIND_BY_DOCUMENT.get(document_type)
    if kind is None:
        return None
    receipt_number = str(receipt_payload.get("receipt_number") or "")
    headline, subtitle = receipt_email_headlines(document_type, receipt_number)
    context: dict[str, object] = {
        "headline": headline,
        "subtitle": subtitle,
        "receipt": receipt_payload,
        **email_context(
            subject=headline,
            headline=headline,
            subtitle=subtitle,
            body=None,
            action_url=public_url(receipt_action_path(document_type, booking_id)),
            action_label="View receipt",
        ),
    }
    return OutgoingEmail(
        to=(to_email,),
        subject=f"{headline} | {APP_NAME}",
        html=render_template(_RECEIPT_HTML_TEMPLATES[kind], context),
        text=render_template(_RECEIPT_TEXT_TEMPLATES[kind], context),
    )


async def send_receipt_email(
    session: AsyncSession,
    mailer: Mailer,
    *,
    user_id: str,
    booking_id: str,
    receipt_payload: dict[str, Any],
) -> None:
    """Email one party their receipt; skipped when deduped or the address is missing. Never raises."""
    document_type = str(receipt_payload.get("document_type") or "")
    kind = _RECEIPT_KIND_BY_DOCUMENT.get(document_type)
    if kind is None:
        return
    email = ((await identity_service.emails_by_id(session, [user_id])).get(user_id) or "").strip()
    if "@" not in email:
        log.info("receipt email skipped, no address user=%s booking=%s kind=%s", user_id, booking_id, kind)
        return
    if not await notifications_repository.claim_email_delivery(
        session,
        template_id=booking_email_template_id(kind),
        recipient_email=email,
        recipient_user_id=user_id,
        booking_id=booking_id,
    ):
        return
    try:
        outgoing = render_receipt_email(receipt_payload, to_email=email, booking_id=booking_id)
    except Exception:
        log.exception(
            "receipt email could not be rendered kind=%s booking=%s user=%s", kind, booking_id, user_id
        )
        return
    if outgoing is None:
        return
    if not mailer.send(outgoing):
        log.warning("receipt email failed kind=%s booking=%s user=%s", kind, booking_id, user_id)


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


def send_dispute_opened_alert(
    mailer: Mailer, *, booking_id: str, dispute_id: str, summary: str, opened_by_email: str | None
) -> bool:
    """Tell staff a dispute was opened (which booking, which dispute, who, and their summary)."""
    alert = dispute_opened_alert(
        booking_id=booking_id, dispute_id=dispute_id, summary=summary, opened_by_email=opened_by_email
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


def render_client_suspended(*, email: str) -> OutgoingEmail:
    """Render the "account suspended" notice for a client, without sending it."""
    return render_booking_notification(email, client_suspended_email(support_url=public_url("/contact")))


def send_client_suspended_email(mailer: Mailer, *, to: str | None) -> bool:
    """Email a client that an admin suspended them. False for a missing/invalid address, never raises."""
    if not to or "@" not in to:
        return False
    try:
        return mailer.send(render_client_suspended(email=to))
    except Exception:
        log.exception("client suspended email could not be sent")
        return False


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


def render_account_deleted(*, email: str) -> OutgoingEmail:
    """Render the "account deleted" confirmation (booking layout, as the baseline), without sending it."""
    return render_booking_notification(email, account_deleted_email())


def send_account_deleted(mailer: Mailer, *, email: str) -> bool:
    """Email `email` that their account was closed. False for an invalid address, never raises."""
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    try:
        return mailer.send(render_account_deleted(email=normalized))
    except Exception:
        log.exception("account deleted email could not be sent")
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
    reason: str | None = None,
) -> OutgoingEmail:
    """Render the approval-change email to `vendor_email` for `approval_status`, without sending it."""
    content = vendor_approval_status_email(
        approval_status=approval_status,
        business_name=business_name,
        listing_visible=listing_visible,
        payouts_verified=payouts_verified,
        reason=reason,
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
    reason: str | None = None,
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
            reason=reason,
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


def _send_vendor_content(
    mailer: Mailer, vendor_email: str | None, content: TransactionalEmail, failure_message: str
) -> bool:
    """Render and send one vendor email. False for a missing/invalid address; never raises."""
    if not vendor_email or "@" not in vendor_email:
        return False
    try:
        return mailer.send(render_booking_notification(vendor_email, content))
    except Exception:
        log.exception(failure_message)
        return False


def send_vendor_listing_hidden(
    mailer: Mailer, *, vendor_email: str | None, business_name: str | None, reason: str
) -> bool:
    """Email a vendor why staff hid their listing and how to appeal."""
    return _send_vendor_content(
        mailer,
        vendor_email,
        vendor_listing_hidden_email(business_name=business_name, reason=reason),
        "vendor listing hidden email could not be sent",
    )


def send_vendor_warning(
    mailer: Mailer, *, vendor_email: str | None, business_name: str | None, message: str
) -> bool:
    """Email a vendor a staff warning."""
    return _send_vendor_content(
        mailer,
        vendor_email,
        vendor_warning_email(business_name=business_name, message=message),
        "vendor warning email could not be sent",
    )


def send_vendor_listing_paused(
    mailer: Mailer,
    *,
    vendor_email: str | None,
    business_name: str | None,
    reason: str,
    paused_until_label: str,
) -> bool:
    """Email a vendor that their listing is paused until a date, and why."""
    return _send_vendor_content(
        mailer,
        vendor_email,
        vendor_listing_paused_email(
            business_name=business_name, reason=reason, paused_until_label=paused_until_label
        ),
        "vendor listing paused email could not be sent",
    )
