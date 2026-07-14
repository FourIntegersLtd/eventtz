"""Transactional email service (Jinja templates + Resend)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.email.constants import APP_NAME
from app.features.email.delivery_log import booking_template_id, claim_booking_email_send
from app.features.email.branding import (
    base_email_context,
    client_welcome_showcase,
    display_name_from_email,
    email_public_base,
    transactional_email_context,
    vendor_welcome_showcase,
)
from app.features.email.render import render_template
from app.features.email.resend_client import send_email as resend_send

logger = get_logger(__name__)


class EmailService:
    def send_booking_notification(
        self,
        *,
        kind: str,
        to_email: str,
        recipient_user_id: str,
        booking_id: str,
        headline: str,
        subtitle: str | None,
        body: str | None,
        action_url: str | None,
        action_label: str = "View booking",
        skip_dedupe: bool = False,
    ) -> bool:
        if not skip_dedupe and not claim_booking_email_send(
            kind=kind,
            recipient_email=to_email,
            recipient_user_id=recipient_user_id,
            booking_id=booking_id,
        ):
            return False

        ctx = transactional_email_context(
            subject=headline,
            headline=headline,
            subtitle=subtitle,
            body=body,
            action_url=action_url,
            action_label=action_label,
        )
        html = render_template("booking/notification.html", ctx)
        text = render_template("booking/notification.txt", ctx)
        subject = f"{headline} | {APP_NAME}"
        ok = resend_send(to=[to_email], subject=subject, html=html, text=text)
        if not ok:
            logger.warning(
                "booking email failed kind=%s booking=%s user=%s",
                kind,
                booking_id,
                recipient_user_id,
            )
        return ok

    def send_admin_alert(
        self,
        *,
        template_id: str,
        subject: str,
        headline: str,
        intro: str | None = None,
        fields: list[tuple[str, str]] | None = None,
        body: str | None = None,
        action_url: str | None = None,
        action_label: str | None = None,
        to: list[str],
    ) -> bool:
        ctx = transactional_email_context(
            subject=subject,
            headline=headline,
            intro=intro,
            fields=fields or [],
            body=body,
            action_url=action_url,
            action_label=action_label,
        )
        html = render_template("admin/alert.html", ctx)
        text = render_template("admin/alert.txt", ctx)
        return resend_send(to=to, subject=subject, html=html, text=text)

    def send_admin_contact_submitted(
        self,
        *,
        portal: str,
        user_email: str | None,
        subject_line: str,
        message: str,
        booking_id: str | None,
        to: list[str],
    ) -> bool:
        fields: list[tuple[str, str]] = [
            ("Portal", portal),
            ("From", user_email or "unknown"),
            ("Subject", subject_line),
        ]
        if booking_id:
            fields.append(("Booking", booking_id))
        return self.send_admin_alert(
            template_id="admin.contact_submitted",
            subject=f"[Eventtz contact] {subject_line}",
            headline="New contact message",
            intro="Someone submitted the contact form.",
            fields=fields,
            body=message,
            to=to,
        )

    def send_admin_dispute_opened(
        self,
        *,
        booking_id: str,
        dispute_id: str,
        summary: str,
        opened_by_email: str | None,
        to: list[str],
        admin_url: str | None = None,
    ) -> bool:
        fields = [
            ("Booking", booking_id),
            ("Dispute", dispute_id),
            ("Opened by", opened_by_email or "unknown"),
        ]
        return self.send_admin_alert(
            template_id="admin.dispute_opened",
            subject=f"[Eventtz ops] Dispute opened | booking {booking_id[:8]}",
            headline="Dispute opened",
            fields=fields,
            body=summary,
            action_url=admin_url,
            action_label="Open in admin" if admin_url else None,
            to=to,
        )

    def send_admin_vendor_submitted(
        self,
        *,
        vendor_user_id: str,
        vendor_email: str | None,
        business_name: str | None,
        to: list[str],
        admin_url: str | None = None,
    ) -> bool:
        fields = [
            ("Vendor ID", vendor_user_id),
            ("Email", vendor_email or "unknown"),
        ]
        if business_name:
            fields.append(("Business", business_name))
        return self.send_admin_alert(
            template_id="admin.vendor_submitted",
            subject="[Eventtz ops] Vendor profile submitted",
            headline="Vendor submitted for review",
            fields=fields,
            action_url=admin_url,
            action_label="Review vendor" if admin_url else None,
            to=to,
        )

    def send_admin_refund_failed(
        self,
        *,
        booking_id: str,
        error_hint: str | None,
        to: list[str],
    ) -> bool:
        return self.send_admin_alert(
            template_id="admin.refund_failed",
            subject=f"[Eventtz ops] Refund failed | booking {booking_id[:8]}",
            headline="Stripe refund failed",
            fields=[("Booking", booking_id)],
            body=error_hint or "Check logs and Stripe dashboard.",
            to=to,
        )

    def send_admin_payout_stuck(
        self,
        *,
        booking_id: str,
        vendor_user_id: str | None,
        error_hint: str | None,
        to: list[str],
    ) -> bool:
        fields: list[tuple[str, str]] = [("Booking", booking_id)]
        if vendor_user_id:
            fields.append(("Vendor ID", vendor_user_id))
        return self.send_admin_alert(
            template_id="admin.payout_stuck",
            subject=f"[Eventtz ops] Payout transfer failed | booking {booking_id[:8]}",
            headline="Vendor payout transfer failed",
            fields=fields,
            body=error_hint or "Stripe transfer failed. Vendor may need Connect verification.",
            to=to,
        )

    def send_vendor_approval_status(
        self,
        *,
        to_email: str,
        approval_status: str,
        business_name: str | None,
        login_url: str,
    ) -> bool:
        biz = (business_name or "").strip()
        if approval_status == "approved":
            headline = "Your vendor profile is approved"
            subtitle = "You are live on Eventtz."
            if biz:
                body = (
                    f"Congratulations: {biz} is now live on Eventtz.\n\n"
                    "Clients can find you and send booking requests. "
                    "Keep your availability and portfolio up to date, "
                    "and connect Stripe if you have not already so you can get paid."
                )
            else:
                body = (
                    "Congratulations: your profile is now live on Eventtz.\n\n"
                    "Clients can find you and send booking requests. "
                    "Keep your availability and portfolio up to date, "
                    "and connect Stripe if you have not already so you can get paid."
                )
        elif approval_status == "banned":
            headline = "Your vendor account was suspended"
            subtitle = "You cannot receive new bookings right now."
            body = (
                "We have suspended your vendor account on Eventtz.\n\n"
                "If you believe this was a mistake, or you need help resolving it, "
                "please contact us and we will look into it carefully."
            )
        else:
            headline = "Your vendor profile is under review"
            subtitle = "Thank you for submitting your details."
            body = (
                "Our team is reviewing your profile now.\n\n"
                "We will email you as soon as a decision is made. "
                "You can still sign in and update your details while you wait."
            )

        ctx = transactional_email_context(
            subject=headline,
            headline=headline,
            subtitle=subtitle,
            body=body,
            action_url=login_url,
            action_label="Open Eventtz",
        )
        html = render_template("booking/notification.html", ctx)
        text = render_template("booking/notification.txt", ctx)
        return resend_send(
            to=[to_email],
            subject=f"{headline} | {APP_NAME}",
            html=html,
            text=text,
        )

    def send_team_invite(
        self,
        *,
        to_email: str,
        login_url: str,
    ) -> bool:
        # Admin-facing: keep concise.
        ctx = transactional_email_context(
            subject="You've been invited to Eventtz admin",
            headline="Admin team invite",
            subtitle="An administrator added you to the Eventtz admin console.",
            body="Sign in with the email address this message was sent to.",
            action_url=login_url,
            action_label="Sign in",
        )
        html = render_template("booking/notification.html", ctx)
        text = render_template("booking/notification.txt", ctx)
        return resend_send(
            to=[to_email],
            subject=f"Eventtz admin invite | {APP_NAME}",
            html=html,
            text=text,
        )

    def send_client_suspended(
        self,
        *,
        to_email: str,
        support_url: str | None = None,
    ) -> bool:
        ctx = transactional_email_context(
            subject="Your Eventtz account was suspended",
            headline="Account suspended",
            subtitle="Your account access has been limited for now.",
            body=(
                "You cannot book or message on Eventtz until this is resolved.\n\n"
                "If you need help or believe this was a mistake, please contact support "
                "and we will look into it carefully."
            ),
            action_url=support_url,
            action_label="Contact support" if support_url else None,
        )
        html = render_template("booking/notification.html", ctx)
        text = render_template("booking/notification.txt", ctx)
        return resend_send(
            to=[to_email],
            subject=f"Account suspended | {APP_NAME}",
            html=html,
            text=text,
        )

    def send_welcome(
        self,
        *,
        to_email: str,
        user_type: str,
        display_name: str | None = None,
    ) -> bool:
        portal = "vendor" if user_type == "vendor" else "client"
        name = (display_name or "").strip() or display_name_from_email(to_email)
        base = email_public_base()

        if portal == "vendor":
            welcome_subtitle = (
                "Welcome aboard. "
                "Eventtz is where clients find you, and where you keep bookings, messages "
                "and payments in one calm place."
            )
            showcase_eyebrow = "How it works for vendors"
            showcase_intro = (
                "A short tour of what happens once your profile is live. "
                "Take it step by step; we are here if you need a hand."
            )
            showcase_intro_plain = showcase_intro
            welcome_cta_lead = (
                "When you have a quiet moment, finish your profile so clients can discover you "
                "with confidence."
            )
            welcome_cta_label = "Go to your dashboard"
            welcome_cta_url = f"{base}/vendor/dashboard"
            welcome_support_line = (
                "Questions? Reply to this email or write us at hello@fourintegers.com. "
                "We are glad you are here."
            )
            showcase_sections = vendor_welcome_showcase()
        else:
            welcome_subtitle = (
                "Welcome aboard. "
                "Whether it is your next owambe, birthday or baby shower, "
                "we are here to help you find vendors you can trust."
            )
            showcase_eyebrow = "A gentle start"
            showcase_intro = (
                "Here is how most people use Eventtz when planning an event. "
                "No rush; browse at your own pace."
            )
            showcase_intro_plain = showcase_intro
            welcome_cta_lead = (
                "Ready when you are: browse vendors and send your first request."
            )
            welcome_cta_label = "Find vendors"
            welcome_cta_url = f"{base}/client/browse"
            welcome_support_line = (
                "Got questions? Reply to this email or write us at hello@fourintegers.com. "
                "We are happy to help."
            )
            showcase_sections = client_welcome_showcase()

        ctx = base_email_context(
            display_name=name,
            welcome_subtitle=welcome_subtitle,
            showcase_eyebrow=showcase_eyebrow,
            showcase_intro=showcase_intro,
            showcase_intro_plain=showcase_intro_plain,
            showcase_sections=showcase_sections,
            welcome_cta_lead=welcome_cta_lead,
            welcome_cta_label=welcome_cta_label,
            welcome_cta_url=welcome_cta_url,
            welcome_support_line=welcome_support_line,
        )
        subject = f"Welcome to {APP_NAME}"
        html = render_template("marketing/welcome.html", ctx)
        text = render_template("marketing/welcome.txt", ctx)
        return resend_send(to=[to_email], subject=subject, html=html, text=text)


_email_service: EmailService | None = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
