"""Send booking and admin emails (in-app notification plus Resend)."""

from __future__ import annotations

from typing import Literal

from app.core.config import get_settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.features.auth.user_vendor_display_lookup import user_emails_by_id, user_types_by_id
from app.features.email.admin_recipients import admin_notify_recipients
from app.features.email.branding import email_public_base, ensure_public_email_url, public_email_url
from app.features.email.service import get_email_service
from app.features.notifications.copy import Portal, format_booking_notification
from app.features.notifications.service import (
    BookingNotifyKind,
    insert_booking_notification_if_absent,
    upsert_booking_notification,
)

logger = get_logger(__name__)

ADMIN_LOGIN_URL = "/login?next=/admin/dashboard"

NotifyMode = Literal["upsert", "insert_if_absent"]


def _email_base() -> str:
    return email_public_base()


def _booking_portal_path(portal: Portal, booking_id: str) -> str:
    return f"/{portal}/bookings/{booking_id}"


def _load_booking_parties(booking_id: str) -> dict[str, str] | None:
    try:
        res = (
            get_db()
            .table("booking_requests")
            .select("id,event_name,client_user_id,vendor_user_id")
            .eq("id", booking_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("_load_booking_parties failed booking=%s", booking_id)
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    return {
        "event_name": str(row.get("event_name") or "").strip(),
        "client_user_id": str(row.get("client_user_id") or ""),
        "vendor_user_id": str(row.get("vendor_user_id") or ""),
    }


def _portal_for_user(user_id: str, parties: dict[str, str]) -> Portal | None:
    if user_id == parties.get("client_user_id"):
        return "client"
    if user_id == parties.get("vendor_user_id"):
        return "vendor"
    return None


def dispatch_booking_notification(
    *,
    user_id: str,
    booking_id: str,
    kind: BookingNotifyKind,
    body: str | None = None,
    mode: NotifyMode = "upsert",
    portal: Portal | None = None,
    event_name: str | None = None,
    send_email: bool = True,
) -> None:
    """Create the in-app notification and send the participant email when email is configured."""
    if mode == "insert_if_absent":
        insert_booking_notification_if_absent(
            user_id=user_id,
            booking_id=booking_id,
            kind=kind,
        )
    else:
        upsert_booking_notification(
            user_id=user_id,
            booking_id=booking_id,
            kind=kind,
            body=body,
        )

    parties = _load_booking_parties(booking_id)
    if not parties:
        return

    resolved_portal = portal or _portal_for_user(user_id, parties)
    if not resolved_portal:
        logger.warning(
            "dispatch_booking_notification skip email: user not on booking user=%s booking=%s",
            user_id,
            booking_id,
        )
        return

    emails = user_emails_by_id([user_id])
    to_email = emails.get(user_id, "").strip()
    if not to_email or "@" not in to_email:
        logger.info(
            "dispatch_booking_notification skip email: no address user=%s booking=%s kind=%s",
            user_id,
            booking_id,
            kind,
        )
        return

    ev = (event_name or parties.get("event_name") or "").strip() or None
    headline, email_body = format_booking_notification(
        kind=kind,
        portal=resolved_portal,
        event_name=ev,
        stored_body=body,
    )

    action_url = f"{_email_base()}{_booking_portal_path(resolved_portal, booking_id)}"
    if not send_email:
        return
    get_email_service().send_booking_notification(
        kind=kind,
        to_email=to_email,
        recipient_user_id=user_id,
        booking_id=booking_id,
        headline=headline,
        subtitle=None,
        body=email_body,
        action_url=action_url,
    )


def _receipt_path(document_type: str, booking_id: str) -> str:
    if document_type == "client_payment_receipt":
        return f"/client/bookings/{booking_id}/receipt"
    if document_type == "vendor_payment_record":
        return f"/vendor/bookings/{booking_id}/payment-record"
    return f"/vendor/bookings/{booking_id}/payout-statement"


def dispatch_receipt_email(
    *,
    user_id: str,
    booking_id: str,
    receipt_payload: dict,
) -> None:
    """Send a structured payment receipt / vendor statement email."""
    parties = _load_booking_parties(booking_id)
    if not parties:
        return

    resolved_portal = _portal_for_user(user_id, parties)
    if not resolved_portal:
        return

    emails = user_emails_by_id([user_id])
    to_email = emails.get(user_id, "").strip()
    if not to_email or "@" not in to_email:
        return

    document_type = str(receipt_payload.get("document_type") or "")
    kind_map = {
        "client_payment_receipt": "payment_receipt",
        "vendor_payment_record": "vendor_payment_record",
        "vendor_payout_statement": "vendor_payout_statement",
    }
    kind = kind_map.get(document_type)
    if not kind:
        return

    action_url = f"{_email_base()}{_receipt_path(document_type, booking_id)}"
    get_email_service().send_receipt_email(
        kind=kind,
        to_email=to_email,
        recipient_user_id=user_id,
        booking_id=booking_id,
        receipt_payload=receipt_payload,
        action_url=action_url,
        action_label="View receipt",
    )


def send_admin_contact_submitted_email(
    *,
    portal: str,
    user_email: str | None,
    subject: str,
    message: str,
    booking_id: str | None,
) -> bool:
    recipients = admin_notify_recipients()
    return get_email_service().send_admin_contact_submitted(
        portal=portal,
        user_email=user_email,
        subject_line=subject,
        message=message,
        booking_id=booking_id,
        to=recipients,
    )


def send_admin_dispute_opened_email(
    *,
    booking_id: str,
    dispute_id: str,
    summary: str,
    opened_by_user_id: str,
) -> bool:
    emails = user_emails_by_id([opened_by_user_id])
    opened_by = emails.get(opened_by_user_id)
    admin_url = f"{_email_base()}/admin/disputes"
    return get_email_service().send_admin_dispute_opened(
        booking_id=booking_id,
        dispute_id=dispute_id,
        summary=summary,
        opened_by_email=opened_by,
        to=admin_notify_recipients(),
        admin_url=admin_url,
    )


def send_admin_vendor_submitted_email(
    *,
    vendor_user_id: str,
    vendor_email: str | None,
    business_name: str | None,
) -> bool:
    admin_url = f"{_email_base()}/admin/vendors"
    return get_email_service().send_admin_vendor_submitted(
        vendor_user_id=vendor_user_id,
        vendor_email=vendor_email,
        business_name=business_name,
        to=admin_notify_recipients(),
        admin_url=admin_url,
    )


def send_admin_refund_failed_email(*, booking_id: str, error_hint: str | None = None) -> bool:
    return get_email_service().send_admin_refund_failed(
        booking_id=booking_id,
        error_hint=error_hint,
        to=admin_notify_recipients(),
    )


def send_admin_payout_stuck_email(
    *,
    booking_id: str,
    vendor_user_id: str | None,
    error_hint: str | None = None,
) -> bool:
    from app.features.email.delivery_log import claim_admin_payout_stuck_email

    if vendor_user_id and not claim_admin_payout_stuck_email(
        booking_id=booking_id,
        vendor_user_id=vendor_user_id,
    ):
        return False
    return get_email_service().send_admin_payout_stuck(
        booking_id=booking_id,
        vendor_user_id=vendor_user_id,
        error_hint=error_hint,
        to=admin_notify_recipients(),
    )


def send_support_new_message_email(
    *,
    recipient_user_id: str,
    conversation_id: str | None = None,
    message_body: str | None = None,
    message_body_html: str | None = None,
) -> bool:
    """Email a client or vendor when Eventtz Support sends them an in-app message."""
    uid = (recipient_user_id or "").strip()
    if not uid:
        return False

    user_type = user_types_by_id([uid]).get(uid, "")
    if user_type == "vendor":
        portal = "vendor"
    elif user_type == "client":
        portal = "client"
    else:
        logger.info(
            "send_support_new_message_email skip: unsupported user_type user=%s type=%s",
            uid,
            user_type or "unknown",
        )
        return False

    emails = user_emails_by_id([uid])
    to_email = emails.get(uid, "").strip()
    if not to_email or "@" not in to_email:
        logger.info("send_support_new_message_email skip: no address user=%s", uid)
        return False

    cid = (conversation_id or "").strip()
    if cid:
        messages_url = public_email_url(f"/{portal}/messages/{cid}")
    else:
        messages_url = public_email_url(f"/{portal}/messages")

    return get_email_service().send_support_new_message(
        to_email=to_email,
        messages_url=messages_url,
        message_body=message_body,
        message_body_html=message_body_html,
    )


def send_vendor_returned_for_edits_email(
    *,
    vendor_user_id: str,
    vendor_email: str | None,
    business_name: str | None,
    admin_message: str | None = None,
) -> bool:
    if not vendor_email or "@" not in vendor_email:
        emails = user_emails_by_id([vendor_user_id])
        vendor_email = emails.get(vendor_user_id)
    if not vendor_email or "@" not in vendor_email:
        return False
    return get_email_service().send_vendor_returned_for_edits(
        to_email=vendor_email,
        business_name=business_name,
        onboarding_url=public_email_url("/vendor/profile"),
        messages_url=public_email_url("/vendor/messages"),
        admin_message=admin_message,
    )


def send_vendor_complete_profile_nudge_email(
    *,
    vendor_user_id: str,
    vendor_email: str | None,
    business_name: str | None,
) -> bool:
    if not vendor_email or "@" not in vendor_email:
        emails = user_emails_by_id([vendor_user_id])
        vendor_email = emails.get(vendor_user_id)
    if not vendor_email or "@" not in vendor_email:
        return False
    onboarding_url = public_email_url("/vendor/profile")
    return get_email_service().send_vendor_complete_profile_nudge(
        to_email=vendor_email,
        business_name=business_name,
        onboarding_url=onboarding_url,
    )


def send_vendor_setup_payouts_nudge_email(
    *,
    vendor_user_id: str,
    vendor_email: str | None,
    business_name: str | None,
) -> bool:
    if not vendor_email or "@" not in vendor_email:
        emails = user_emails_by_id([vendor_user_id])
        vendor_email = emails.get(vendor_user_id)
    if not vendor_email or "@" not in vendor_email:
        return False
    return get_email_service().send_vendor_setup_payouts_nudge(
        to_email=vendor_email,
        business_name=business_name,
        payments_url=public_email_url("/vendor/payments"),
        dashboard_url=public_email_url("/vendor/dashboard"),
    )


def send_vendor_approval_email(
    *,
    vendor_user_id: str,
    vendor_email: str | None,
    approval_status: str,
    business_name: str | None,
    listing_visible: bool = False,
    payouts_verified: bool = False,
) -> bool:
    if not vendor_email or "@" not in vendor_email:
        emails = user_emails_by_id([vendor_user_id])
        vendor_email = emails.get(vendor_user_id)
    if not vendor_email or "@" not in vendor_email:
        return False
    login_url = f"{_email_base()}/signin"
    return get_email_service().send_vendor_approval_status(
        to_email=vendor_email,
        approval_status=approval_status,
        business_name=business_name,
        login_url=login_url,
        payments_url=public_email_url("/vendor/payments"),
        dashboard_url=public_email_url("/vendor/dashboard"),
        listing_visible=listing_visible,
        payouts_verified=payouts_verified,
    )


def send_team_invite_email(*, email: str) -> bool:
    login_url = public_email_url(ADMIN_LOGIN_URL)
    return get_email_service().send_team_invite(to_email=email.strip().lower(), login_url=login_url)


def send_client_suspended_email(*, email: str) -> bool:
    support_url = f"{_email_base()}/contact"
    return get_email_service().send_client_suspended(to_email=email, support_url=support_url)


def send_account_deleted_email(*, email: str) -> bool:
    normalized = (email or "").strip().lower()
    if not normalized or "@" not in normalized:
        return False
    try:
        return get_email_service().send_account_deleted(to_email=normalized)
    except Exception:
        logger.exception("send_account_deleted_email failed")
        return False


def send_welcome_email(*, email: str, user_type: str) -> bool:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    if user_type not in {"client", "vendor", "admin"}:
        return False
    try:
        if user_type == "admin":
            return send_admin_welcome_email(email=normalized)
        return get_email_service().send_welcome(
            to_email=normalized,
            user_type=user_type,
        )
    except Exception:
        logger.exception("send_welcome_email failed email=%s user_type=%s", normalized, user_type)
        return False


def send_admin_welcome_email(*, email: str) -> bool:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    try:
        login_url = public_email_url(ADMIN_LOGIN_URL)
        return get_email_service().send_admin_welcome(to_email=normalized, login_url=login_url)
    except Exception:
        logger.exception("send_admin_welcome_email failed email=%s", normalized)
        return False


def send_password_changed_email(*, email: str, user_type: str | None = None) -> bool:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    login_path = ADMIN_LOGIN_URL if user_type == "admin" else "/login"
    login_url = public_email_url(login_path)
    try:
        return get_email_service().send_password_changed(to_email=normalized, login_url=login_url)
    except Exception:
        logger.exception("send_password_changed_email failed email=%s", normalized)
        return False


def send_password_reset_email(
    *,
    email: str,
    reset_url: str,
    expires_minutes: int = 60,
    user_type: str | None = None,
    purpose: Literal["reset", "setup"] = "reset",
) -> bool:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized or not reset_url.strip():
        return False
    try:
        return get_email_service().send_password_reset(
            to_email=normalized,
            reset_url=ensure_public_email_url(reset_url.strip()),
            expires_minutes=expires_minutes,
            user_type=user_type,
            purpose=purpose,
        )
    except Exception:
        logger.exception("send_password_reset_email failed email=%s", normalized)
        return False


def send_email_verification_email(
    *,
    email: str,
    verify_url: str,
    expires_minutes: int = 60,
    user_type: str | None = None,
) -> bool:
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized or not verify_url.strip():
        return False
    try:
        return get_email_service().send_email_verification(
            to_email=normalized,
            verify_url=ensure_public_email_url(verify_url.strip()),
            expires_minutes=expires_minutes,
            user_type=user_type,
        )
    except Exception:
        logger.exception("send_email_verification_email failed email=%s", normalized)
        return False
