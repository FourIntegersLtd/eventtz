"""Transactional email (Resend + Jinja + dedupe)."""

from unittest.mock import MagicMock, patch

import pytest

from app.features.email.constants import ADMIN_NOTIFY_RECIPIENTS, EMAIL_FROM, EMAIL_IMAGE_BASE, EMAIL_IMAGES
from app.features.email.delivery_log import claim_booking_email_send, should_dedupe_booking_kind
from app.features.email.dispatch import (
    dispatch_booking_notification,
    send_admin_contact_submitted_email,
)
from app.features.email.service import EmailService


def test_constants_hardcoded_admin_recipients():
    assert "hello@eventtz.com" in ADMIN_NOTIFY_RECIPIENTS
    assert EMAIL_FROM == "Eventtz <hello@eventtz.com>"


def test_email_images_use_eventtz_s3_bucket():
    assert EMAIL_IMAGE_BASE == "https://eventtz.s3.eu-west-2.amazonaws.com/email"
    assert EMAIL_IMAGES["logo"] == f"{EMAIL_IMAGE_BASE}/eventtz-logo.png"
    assert EMAIL_IMAGES["welcome_clients"] == f"{EMAIL_IMAGE_BASE}/welcome-clients.png"
    assert EMAIL_IMAGES["welcome_vendors"] == f"{EMAIL_IMAGE_BASE}/welcome-vendors.png"


def test_payment_received_client_body_mentions_dispute_window() -> None:
    from app.features.notifications.copy import PAYMENT_RECEIVED_CLIENT_BODY

    assert "48 hours" in PAYMENT_RECEIVED_CLIENT_BODY
    assert "report a problem" in PAYMENT_RECEIVED_CLIENT_BODY
    assert "Thank you for booking with Eventtz" in PAYMENT_RECEIVED_CLIENT_BODY
    assert "\u2014" not in PAYMENT_RECEIVED_CLIENT_BODY
    assert "\u2013" not in PAYMENT_RECEIVED_CLIENT_BODY


def test_should_dedupe_booking_kind():
    assert should_dedupe_booking_kind("payment_received") is True
    assert should_dedupe_booking_kind("booking_request_received") is False


@patch("app.features.email.delivery_log.get_db")
@patch("app.features.email.delivery_log.get_settings")
def test_claim_booking_email_send_non_dedupe_always_proceeds(mock_settings, mock_get_client):
    assert claim_booking_email_send(
        kind="booking_request_received",
        recipient_email="a@example.com",
        recipient_user_id="user-1",
        booking_id="booking-1",
    ) is True
    mock_get_client.assert_not_called()


@patch("app.features.email.delivery_log.get_db")
@patch("app.features.email.delivery_log.get_settings")
def test_claim_booking_email_send_dedupe_inserts(mock_settings, mock_get_client):
    client = MagicMock()
    mock_get_client.return_value = client
    assert claim_booking_email_send(
        kind="payment_received",
        recipient_email="a@example.com",
        recipient_user_id="user-1",
        booking_id="booking-1",
    ) is True
    client.table.assert_called_with("email_delivery_log")


@patch("app.features.email.delivery_log.get_db")
@patch("app.features.email.delivery_log.get_settings")
def test_claim_booking_email_send_dedupe_skips_duplicate(mock_settings, mock_get_client):
    client = MagicMock()
    client.table.return_value.insert.return_value.execute.side_effect = Exception("duplicate key 23505")
    mock_get_client.return_value = client
    assert claim_booking_email_send(
        kind="payment_received",
        recipient_email="a@example.com",
        recipient_user_id="user-1",
        booking_id="booking-1",
    ) is False


@patch("app.features.email.service.resend_send")
@patch("app.features.email.service.claim_booking_email_send", return_value=True)
@patch("app.features.email.service.render_template")
def test_email_service_send_booking_notification(mock_render, mock_claim, mock_resend):
    mock_render.side_effect = lambda name, ctx: f"{name}:{ctx['headline']}"
    mock_resend.return_value = True
    svc = EmailService()
    ok = svc.send_booking_notification(
        kind="booking_request_received",
        to_email="vendor@example.com",
        recipient_user_id="vendor-1",
        booking_id="booking-1",
        headline="New booking request",
        subtitle=None,
        body="Review the details.",
        action_url="http://localhost:3000/vendor/bookings/booking-1",
    )
    assert ok is True
    mock_claim.assert_called_once()
    mock_resend.assert_called_once()
    args = mock_resend.call_args.kwargs
    assert args["to"] == ["vendor@example.com"]
    assert "New booking request" in args["subject"]


@patch("app.features.email.dispatch._load_booking_parties", return_value=None)
@patch("app.features.email.dispatch.get_email_service")
@patch("app.features.email.dispatch.upsert_booking_notification")
def test_dispatch_booking_notification_skips_email_without_parties(
    mock_upsert,
    mock_get_svc,
    _mock_parties,
):
    dispatch_booking_notification(
        user_id="vendor-1",
        booking_id="booking-1",
        kind="booking_request_received",
    )
    mock_upsert.assert_called_once()
    mock_get_svc.assert_not_called()


@patch("app.features.email.dispatch.get_email_service")
def test_send_admin_contact_uses_service(mock_get_svc):
    svc = MagicMock()
    svc.send_admin_contact_submitted.return_value = True
    mock_get_svc.return_value = svc
    ok = send_admin_contact_submitted_email(
        portal="client",
        user_email="user@example.com",
        subject="Help",
        message="Need assistance",
        booking_id=None,
    )
    assert ok is True
    svc.send_admin_contact_submitted.assert_called_once()
    recipients = svc.send_admin_contact_submitted.call_args.kwargs["to"]
    assert list(recipients) == list(ADMIN_NOTIFY_RECIPIENTS)


def test_display_name_from_email():
    from app.features.email.branding import display_name_from_email

    assert display_name_from_email("y.hkehinde@yahoo.com") == "Y Hkehinde"
    assert display_name_from_email("") == "there"


@patch("app.features.email.service.get_settings")
def test_welcome_template_renders_client_showcase(mock_svc_settings):
    from app.features.email.render import render_template
    from app.features.email.branding import base_email_context, client_welcome_showcase

    ctx = base_email_context(
        display_name="Yemi",
        welcome_subtitle="You just joined Eventtz.",
        showcase_eyebrow="A quick peek",
        showcase_intro="Here is how most people use Eventtz when planning an event.",
        showcase_intro_plain="Here is how most people use Eventtz when planning an event.",
        showcase_sections=client_welcome_showcase(),
        welcome_cta_lead="Ready to start?",
        welcome_cta_label="Find vendors",
        welcome_cta_url="https://eventtz.com/client/browse",
        welcome_support_line="Got questions? Reply to this email.",
    )
    html = render_template("marketing/welcome.html", ctx)
    assert "Hello Yemi" in html
    assert "Instagram comments and DMs" in html
    assert "eventtz.com/compliances/privacy-policy" in html
    assert "Eventtz Ltd" in html
    assert "eventtz.com" in html
    assert "localhost" not in html
    assert "#3e1964" in html
    assert 'background-color: #ffffff' in html


def test_admin_alert_template_renders_ops_chrome():
    from app.features.email.render import render_template
    from app.features.email.branding import transactional_email_context

    ctx = transactional_email_context(
        subject="[Eventtz contact] Help",
        headline="New contact message",
        intro="Someone submitted the contact form.",
        fields=[("From", "user@example.com"), ("Subject", "Help")],
        body="Need assistance with my booking.",
        chip_label="CONTACT",
        chip_tone="gray",
        action_url="https://www.eventtz.com/login?next=/admin/dashboard",
        action_label="Sign in to admin",
    )
    html = render_template("admin/alert.html", ctx)
    assert "CONTACT" in html
    assert html.count("Sign in to admin") == 1
    assert 'align="center"' in html
    assert "Eventtz ops" not in html
    assert "Internal notification" in html
    assert "you have an Eventtz account" not in html
    assert 'background-color: #ffffff' in html
    assert "Need assistance with my booking." in html


def test_transactional_notification_uses_full_width_white_layout():
    from app.features.email.render import render_template
    from app.features.email.branding import transactional_email_context

    ctx = transactional_email_context(
        subject="Booking accepted",
        headline="Your booking was accepted",
        body="The vendor confirmed your date.",
        action_url="https://eventtz.com/client/bookings/1",
        action_label="View booking",
    )
    html = render_template("booking/notification.html", ctx)
    assert 'background-color: #ffffff' in html
    assert "Your booking was accepted" in html
    assert "View booking" in html
    assert 'width="160"' in html
    assert "bottom_spacer" not in html
    assert "&nbsp;" in html


@patch("app.features.email.service.resend_send", return_value=True)
@patch("app.features.email.service.get_settings")
def test_send_welcome_vendor(mock_settings, mock_resend):
    mock_settings.return_value.frontend_url = "https://eventtz.com"
    svc = EmailService()
    ok = svc.send_welcome(to_email="vendor@example.com", user_type="vendor")
    assert ok is True
    mock_resend.assert_called_once()
    assert mock_resend.call_args.kwargs["subject"] == "Welcome to Eventtz"
    assert "vendor@example.com" in mock_resend.call_args.kwargs["to"]
    assert "welcome-vendors.png" in mock_resend.call_args.kwargs["html"]


@patch("app.features.email.service.resend_send", return_value=True)
@patch("app.features.email.service.get_settings")
def test_send_welcome_client_hero(mock_settings, mock_resend):
    mock_settings.return_value.frontend_url = "https://eventtz.com"
    svc = EmailService()
    ok = svc.send_welcome(to_email="client@example.com", user_type="client")
    assert ok is True
    assert "welcome-clients.png" in mock_resend.call_args.kwargs["html"]


@patch("app.features.email.dispatch.get_email_service")
def test_send_welcome_email_via_dispatch(mock_get_svc):
    from app.features.email.dispatch import send_welcome_email

    svc = MagicMock()
    svc.send_welcome.return_value = True
    mock_get_svc.return_value = svc
    assert send_welcome_email(email="a@example.com", user_type="client") is True
    svc.send_welcome.assert_called_once()


@patch("app.features.email.service.resend_send", return_value=True)
def test_vendor_returned_for_edits_email_includes_admin_message(mock_resend):
    svc = EmailService()
    ok = svc.send_vendor_returned_for_edits(
        to_email="vendor@example.com",
        business_name="Scenery Studios",
        onboarding_url="https://eventtz.com/vendor/profile",
        messages_url="https://eventtz.com/vendor/messages",
        admin_message="Please add a profile photo.\n\nUpdate your profile when ready.",
    )
    assert ok is True
    text = mock_resend.call_args.kwargs["text"]
    assert "Please add a profile photo." in text
    assert "Scenery Studios" in text
    assert "Your profile is unlocked" in text
    assert "Read message in Eventtz" in text
    assert "https://eventtz.com/vendor/messages" in text
    assert "Update your profile" in text
    assert "https://eventtz.com/vendor/profile" in text


@patch("app.features.email.service.resend_send", return_value=True)
def test_vendor_returned_for_edits_email_without_admin_message(mock_resend):
    svc = EmailService()
    ok = svc.send_vendor_returned_for_edits(
        to_email="vendor@example.com",
        business_name="Scenery Studios",
        onboarding_url="https://eventtz.com/vendor/profile",
        messages_url="https://eventtz.com/vendor/messages",
    )
    assert ok is True
    text = mock_resend.call_args.kwargs["text"]
    assert "Sign in to read what is missing in Eventtz Support" in text


@patch("app.features.email.dispatch.get_email_service")
@patch("app.features.email.dispatch.user_emails_by_id")
def test_send_vendor_returned_for_edits_email_resolves_recipient(mock_lookup, mock_get_svc):
    mock_lookup.return_value = {"vendor-1": "vendor@example.com"}
    svc = MagicMock()
    svc.send_vendor_returned_for_edits.return_value = True
    mock_get_svc.return_value = svc
    from app.features.email.dispatch import send_vendor_returned_for_edits_email

    ok = send_vendor_returned_for_edits_email(
        vendor_user_id="vendor-1",
        vendor_email=None,
        business_name="Scenery Studios",
        admin_message="Add your packages.",
    )
    assert ok is True
    mock_lookup.assert_called_once_with(["vendor-1"])
    svc.send_vendor_returned_for_edits.assert_called_once_with(
        to_email="vendor@example.com",
        business_name="Scenery Studios",
        onboarding_url="https://www.eventtz.com/vendor/profile",
        messages_url="https://www.eventtz.com/vendor/messages",
        admin_message="Add your packages.",
    )


@patch("app.features.email.dispatch.user_emails_by_id", return_value={})
def test_send_vendor_returned_for_edits_email_skips_without_address(mock_lookup):
    from app.features.email.dispatch import send_vendor_returned_for_edits_email

    ok = send_vendor_returned_for_edits_email(
        vendor_user_id="vendor-1",
        vendor_email=None,
        business_name="Scenery Studios",
        admin_message="Add your packages.",
    )
    assert ok is False
    mock_lookup.assert_called_once_with(["vendor-1"])


@patch("app.features.email.service.resend_send", return_value=True)
def test_vendor_approval_email_live_when_listing_visible(mock_resend):
    svc = EmailService()
    ok = svc.send_vendor_approval_status(
        to_email="vendor@example.com",
        approval_status="approved",
        business_name="YHK Ltd",
        login_url="https://eventtz.com/signin",
        payments_url="https://eventtz.com/vendor/payments",
        dashboard_url="https://eventtz.com/vendor/dashboard",
        listing_visible=True,
        payouts_verified=True,
    )
    assert ok is True
    html = mock_resend.call_args.kwargs["html"]
    text = mock_resend.call_args.kwargs["text"]
    assert "You are live on Eventtz" in html
    assert "You are live on Eventtz" in text
    assert "One step left" not in html
    assert "https://eventtz.com/vendor/dashboard" in html
    assert "Go to dashboard" in html


@patch("app.features.email.service.resend_send", return_value=True)
def test_vendor_approval_email_not_live_without_payouts(mock_resend):
    svc = EmailService()
    ok = svc.send_vendor_approval_status(
        to_email="vendor@example.com",
        approval_status="approved",
        business_name="YHK Ltd",
        login_url="https://eventtz.com/signin",
        payments_url="https://eventtz.com/vendor/payments",
        dashboard_url="https://eventtz.com/vendor/dashboard",
        listing_visible=False,
        payouts_verified=False,
    )
    assert ok is True
    html = mock_resend.call_args.kwargs["html"]
    text = mock_resend.call_args.kwargs["text"]
    assert "One step left before clients can find you" in html
    assert "You are live on Eventtz" not in html
    assert "stays hidden from clients" in text
    assert "https://eventtz.com/vendor/payments" in html
    assert "Set up payouts" in html


@patch("app.features.email.service.resend_send", return_value=True)
def test_send_support_new_message_email(mock_resend):
    svc = EmailService()
    ok = svc.send_support_new_message(
        to_email="vendor@example.com",
        messages_url="https://www.eventtz.com/vendor/messages/conv-1",
        message_body="We fixed the profile editing issue. Thank you for reporting it.",
    )
    assert ok is True
    assert mock_resend.call_args.kwargs["to"] == ["vendor@example.com"]
    assert "New message from Eventtz Support" in mock_resend.call_args.kwargs["subject"]
    text = mock_resend.call_args.kwargs["text"]
    assert "We fixed the profile editing issue" in text
    assert "Sign in to read this thread and reply" in text


@patch("app.features.email.service.resend_send", return_value=True)
def test_send_support_new_message_email_with_html(mock_resend):
    svc = EmailService()
    ok = svc.send_support_new_message(
        to_email="vendor@example.com",
        messages_url="https://www.eventtz.com/vendor/messages/conv-1",
        message_body="Please update your profile.",
        message_body_html="<p>Please <strong>update</strong> your profile.</p>",
    )
    assert ok is True
    html = mock_resend.call_args.kwargs["html"]
    text = mock_resend.call_args.kwargs["text"]
    assert "<strong>update</strong>" in html
    assert "<strong>" not in text
    assert "Please update your profile." in text
    assert "Sign in to read this thread and reply" in text


@patch("app.features.email.service.resend_send", return_value=True)
def test_send_support_new_message_email_without_body(mock_resend):
    svc = EmailService()
    ok = svc.send_support_new_message(
        to_email="vendor@example.com",
        messages_url="https://www.eventtz.com/vendor/messages",
    )
    assert ok is True
    assert "Eventtz Support sent you a message" in mock_resend.call_args.kwargs["text"]


@patch("app.features.email.dispatch.get_email_service")
@patch("app.features.email.dispatch.user_types_by_id")
@patch("app.features.email.dispatch.user_emails_by_id")
@patch("app.features.email.dispatch.get_settings")
def test_send_support_new_message_email_dispatch_vendor(
    mock_settings,
    mock_emails,
    mock_types,
    mock_get_svc,
):
    mock_types.return_value = {"vendor-1": "vendor"}
    mock_emails.return_value = {"vendor-1": "vendor@example.com"}
    svc = MagicMock()
    svc.send_support_new_message.return_value = True
    mock_get_svc.return_value = svc

    from app.features.email.dispatch import send_support_new_message_email

    ok = send_support_new_message_email(
        recipient_user_id="vendor-1",
        conversation_id="conv-abc",
        message_body="Hello from support",
    )
    assert ok is True
    svc.send_support_new_message.assert_called_once_with(
        to_email="vendor@example.com",
        messages_url="https://www.eventtz.com/vendor/messages/conv-abc",
        message_body="Hello from support",
        message_body_html=None,
    )


@patch("app.features.email.dispatch.get_settings")
def test_send_support_new_message_email_skips_admin(mock_settings):
    from app.features.email.dispatch import send_support_new_message_email

    with patch("app.features.email.dispatch.user_types_by_id", return_value={"admin-1": "admin"}):
        ok = send_support_new_message_email(recipient_user_id="admin-1", conversation_id="conv-1")
    assert ok is False
