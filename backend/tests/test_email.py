"""Transactional email (Resend + Jinja + dedupe)."""

from unittest.mock import MagicMock, patch

import pytest

from app.features.email.constants import ADMIN_NOTIFY_RECIPIENTS, EMAIL_FROM
from app.features.email.delivery_log import claim_booking_email_send, should_dedupe_booking_kind
from app.features.email.dispatch import (
    dispatch_booking_notification,
    send_admin_contact_submitted_email,
)
from app.features.email.service import EmailService


def test_constants_hardcoded_admin_recipients():
    assert "hello@eventtz.com" in ADMIN_NOTIFY_RECIPIENTS
    assert EMAIL_FROM == "Eventtz <hello@eventtz.com>"


def test_should_dedupe_booking_kind():
    assert should_dedupe_booking_kind("payment_received") is True
    assert should_dedupe_booking_kind("booking_request_received") is False


@patch("app.features.email.delivery_log.get_client")
@patch("app.features.email.delivery_log.get_settings")
def test_claim_booking_email_send_non_dedupe_always_proceeds(mock_settings, mock_get_client):
    mock_settings.return_value.local_auth_mode = False
    assert claim_booking_email_send(
        kind="booking_request_received",
        recipient_email="a@example.com",
        recipient_user_id="user-1",
        booking_id="booking-1",
    ) is True
    mock_get_client.assert_not_called()


@patch("app.features.email.delivery_log.get_client")
@patch("app.features.email.delivery_log.get_settings")
def test_claim_booking_email_send_dedupe_inserts(mock_settings, mock_get_client):
    mock_settings.return_value.local_auth_mode = False
    client = MagicMock()
    mock_get_client.return_value = client
    assert claim_booking_email_send(
        kind="payment_received",
        recipient_email="a@example.com",
        recipient_user_id="user-1",
        booking_id="booking-1",
    ) is True
    client.table.assert_called_with("email_delivery_log")


@patch("app.features.email.delivery_log.get_client")
@patch("app.features.email.delivery_log.get_settings")
def test_claim_booking_email_send_dedupe_skips_duplicate(mock_settings, mock_get_client):
    mock_settings.return_value.local_auth_mode = False
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


@patch("app.features.email.dispatch.get_email_service")
@patch("app.features.email.dispatch.upsert_booking_notification")
@patch("app.features.email.dispatch.get_settings")
def test_dispatch_booking_notification_skips_email_in_local_auth(
    mock_settings,
    mock_upsert,
    mock_get_svc,
):
    mock_settings.return_value.local_auth_mode = True
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
    mock_svc_settings.return_value.local_auth_mode = False
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


@patch("app.features.email.service.resend_send", return_value=True)
@patch("app.features.email.service.get_settings")
def test_send_welcome_vendor(mock_settings, mock_resend):
    mock_settings.return_value.frontend_url = "https://eventtz.com"
    mock_settings.return_value.local_auth_mode = False
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
    mock_settings.return_value.local_auth_mode = False
    svc = EmailService()
    ok = svc.send_welcome(to_email="client@example.com", user_type="client")
    assert ok is True
    assert "welcome-clients.png" in mock_resend.call_args.kwargs["html"]


@patch("app.features.email.dispatch.get_settings")
def test_send_welcome_email_skips_local_auth(mock_settings):
    mock_settings.return_value.local_auth_mode = True
    from app.features.email.dispatch import send_welcome_email

    assert send_welcome_email(email="a@example.com", user_type="client") is False
