"""List email templates and send test messages for super-admins."""

from __future__ import annotations

from dataclasses import dataclass

from app.features.email.branding import email_public_base
from app.features.email.service import get_email_service
from app.features.notifications.copy import _COPY, _USE_STORED_BODY, Portal, format_booking_notification

TEST_BOOKING_ID = "00000000-0000-4000-8000-000000000001"
TEST_USER_ID = "00000000-0000-4000-8000-000000000002"
SAMPLE_EVENT = "Sample Owambe"
SAMPLE_STORED_BODY = "£500 total for catering on 12 August."
SAMPLE_BUSINESS = "Tasty Bites Catering"


@dataclass(frozen=True)
class EmailTestTemplate:
    id: str
    label: str
    category: str
    description: str | None = None


def _static_templates() -> list[EmailTestTemplate]:
    return [
        EmailTestTemplate(
            "welcome.client",
            "Welcome (client)",
            "Marketing",
            "Post-signup welcome for clients.",
        ),
        EmailTestTemplate(
            "welcome.vendor",
            "Welcome (vendor)",
            "Marketing",
            "Post-signup welcome for vendors.",
        ),
        EmailTestTemplate(
            "vendor.approved",
            "Vendor approved",
            "Account",
            "Vendor profile approved and live.",
        ),
        EmailTestTemplate(
            "vendor.pending",
            "Vendor pending review",
            "Account",
            "Vendor submitted profile, awaiting review.",
        ),
        EmailTestTemplate(
            "vendor.banned",
            "Vendor suspended",
            "Account",
            "Vendor account suspended.",
        ),
        EmailTestTemplate(
            "team_invite",
            "Admin team invite",
            "Account",
            "Invite to the Eventtz admin console.",
        ),
        EmailTestTemplate(
            "client.suspended",
            "Client suspended",
            "Account",
            "Client account suspended.",
        ),
        EmailTestTemplate(
            "admin.contact_submitted",
            "Admin: contact submitted",
            "Admin alerts",
            "Contact form submission for ops.",
        ),
        EmailTestTemplate(
            "admin.dispute_opened",
            "Admin: dispute opened",
            "Admin alerts",
            "New dispute opened on a booking.",
        ),
        EmailTestTemplate(
            "admin.vendor_submitted",
            "Admin: vendor submitted",
            "Admin alerts",
            "Vendor profile submitted for review.",
        ),
        EmailTestTemplate(
            "admin.refund_failed",
            "Admin: refund failed",
            "Admin alerts",
            "Stripe refund failure.",
        ),
        EmailTestTemplate(
            "admin.payout_stuck",
            "Admin: payout stuck",
            "Admin alerts",
            "Vendor payout transfer failure.",
        ),
    ]


def _booking_templates() -> list[EmailTestTemplate]:
    items: list[EmailTestTemplate] = []
    for kind in sorted(_COPY.keys()):
        portals = _COPY[kind]
        for portal in sorted(portals.keys()):
            title, _ = portals[portal]
            items.append(
                EmailTestTemplate(
                    id=f"booking.{kind}.{portal}",
                    label=f"{title} ({portal})",
                    category="Booking",
                    description=f"Booking notification `{kind}` for the {portal} portal.",
                ),
            )
    return items


def list_email_test_templates() -> list[EmailTestTemplate]:
    return _static_templates() + _booking_templates()


def _template_ids() -> set[str]:
    return {t.id for t in list_email_test_templates()}


def send_email_test(*, template_id: str, to_email: str) -> tuple[bool, str | None]:
    """Send a sample email. Returns (delivered, message)."""
    tid = template_id.strip()
    if tid not in _template_ids():
        raise ValueError("Unknown email template.")

    email = to_email.strip().lower()
    if not email or "@" not in email:
        raise ValueError("Enter a valid email address.")

    svc = get_email_service()
    base = email_public_base()

    if tid == "welcome.client":
        ok = svc.send_welcome(to_email=email, user_type="client", display_name="Ada")
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "welcome.vendor":
        ok = svc.send_welcome(to_email=email, user_type="vendor", display_name="Chidi")
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid.startswith("vendor."):
        status = tid.split(".", 1)[1]
        if status not in {"approved", "pending", "banned"}:
            raise ValueError("Unknown email template.")
        ok = svc.send_vendor_approval_status(
            to_email=email,
            approval_status=status,
            business_name=SAMPLE_BUSINESS,
            login_url=f"{base}/signin",
        )
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "team_invite":
        ok = svc.send_team_invite(to_email=email, login_url=f"{base}/signin")
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "client.suspended":
        ok = svc.send_client_suspended(to_email=email, support_url=f"{base}/contact")
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "admin.contact_submitted":
        ok = svc.send_admin_contact_submitted(
            portal="client",
            user_email=email,
            subject_line="Sample contact message",
            message="This is a test contact form submission from the admin console.",
            booking_id=TEST_BOOKING_ID,
            to=[email],
        )
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "admin.dispute_opened":
        ok = svc.send_admin_dispute_opened(
            booking_id=TEST_BOOKING_ID,
            dispute_id="00000000-0000-4000-8000-000000000099",
            summary="Sample dispute: vendor did not show up.",
            opened_by_email=email,
            to=[email],
            admin_url=f"{base}/admin/trust?tab=disputes",
        )
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "admin.vendor_submitted":
        ok = svc.send_admin_vendor_submitted(
            vendor_user_id=TEST_USER_ID,
            vendor_email=email,
            business_name=SAMPLE_BUSINESS,
            to=[email],
            admin_url=f"{base}/admin/directory?tab=vendors",
        )
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "admin.refund_failed":
        ok = svc.send_admin_refund_failed(
            booking_id=TEST_BOOKING_ID,
            error_hint="Sample Stripe error: charge already refunded.",
            to=[email],
        )
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid == "admin.payout_stuck":
        ok = svc.send_admin_payout_stuck(
            booking_id=TEST_BOOKING_ID,
            vendor_user_id=TEST_USER_ID,
            error_hint="Sample Stripe error: insufficient funds in platform balance.",
            to=[email],
        )
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    if tid.startswith("booking."):
        parts = tid.split(".", 2)
        if len(parts) != 3:
            raise ValueError("Unknown email template.")
        _, kind, portal_raw = parts
        if portal_raw not in ("client", "vendor"):
            raise ValueError("Unknown email template.")
        portal: Portal = portal_raw  # type: ignore[assignment]
        if kind not in _COPY or portal not in _COPY[kind]:
            raise ValueError("Unknown email template.")

        stored = SAMPLE_STORED_BODY if kind in _USE_STORED_BODY else None
        headline, body = format_booking_notification(
            kind=kind,
            portal=portal,
            event_name=SAMPLE_EVENT,
            stored_body=stored,
        )
        action_url = f"{base}/{portal}/bookings/{TEST_BOOKING_ID}"
        ok = svc.send_booking_notification(
            kind=kind,
            to_email=email,
            recipient_user_id=TEST_USER_ID,
            booking_id=TEST_BOOKING_ID,
            headline=headline,
            subtitle=None,
            body=body,
            action_url=action_url,
            skip_dedupe=True,
        )
        return ok, None if ok else "Email was not sent. Check RESEND_API_KEY and logs."

    raise ValueError("Unknown email template.")
