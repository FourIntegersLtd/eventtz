"""Booking and admin email orchestration (in-app notification + Resend)."""

from __future__ import annotations

from typing import Literal

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.auth.lookup import user_emails_by_id
from app.features.email.admin_recipients import admin_notify_recipients
from app.features.email.service import get_email_service
from app.features.notifications.copy import Portal, format_booking_notification
from app.features.notifications.service import (
    BookingNotifyKind,
    insert_booking_notification_if_absent,
    upsert_booking_notification,
)

logger = get_logger(__name__)

NotifyMode = Literal["upsert", "insert_if_absent"]


def _frontend_base() -> str:
    return get_settings().frontend_url.strip().rstrip("/")


def _booking_portal_path(portal: Portal, booking_id: str) -> str:
    return f"/{portal}/bookings/{booking_id}"


def _load_booking_parties(booking_id: str) -> dict[str, str] | None:
    if get_settings().local_auth_mode:
        return None
    try:
        res = (
            get_client()
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
) -> None:
    """Write in-app notification and send participant email when configured."""
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

    if get_settings().local_auth_mode:
        return

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

    action_url = f"{_frontend_base()}{_booking_portal_path(resolved_portal, booking_id)}"
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
    admin_url = f"{_frontend_base()}/admin/disputes"
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
    admin_url = f"{_frontend_base()}/admin/vendors"
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
    return get_email_service().send_admin_payout_stuck(
        booking_id=booking_id,
        vendor_user_id=vendor_user_id,
        error_hint=error_hint,
        to=admin_notify_recipients(),
    )


def send_vendor_approval_email(
    *,
    vendor_user_id: str,
    vendor_email: str | None,
    approval_status: str,
    business_name: str | None,
) -> bool:
    if not vendor_email or "@" not in vendor_email:
        emails = user_emails_by_id([vendor_user_id])
        vendor_email = emails.get(vendor_user_id)
    if not vendor_email or "@" not in vendor_email:
        return False
    login_url = f"{_frontend_base()}/auth/login"
    return get_email_service().send_vendor_approval_status(
        to_email=vendor_email,
        approval_status=approval_status,
        business_name=business_name,
        login_url=login_url,
    )


def send_team_invite_email(*, email: str) -> bool:
    login_url = f"{_frontend_base()}/auth/login"
    return get_email_service().send_team_invite(to_email=email.strip().lower(), login_url=login_url)


def send_client_suspended_email(*, email: str) -> bool:
    support_url = f"{_frontend_base()}/contact"
    return get_email_service().send_client_suspended(to_email=email, support_url=support_url)


def send_welcome_email(*, email: str, user_type: str) -> bool:
    if get_settings().local_auth_mode:
        return False
    normalized = email.strip().lower()
    if not normalized or "@" not in normalized:
        return False
    if user_type not in {"client", "vendor"}:
        return False
    try:
        return get_email_service().send_welcome(
            to_email=normalized,
            user_type=user_type,
        )
    except Exception:
        logger.exception("send_welcome_email failed email=%s user_type=%s", normalized, user_type)
        return False
