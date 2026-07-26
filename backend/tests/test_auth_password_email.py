"""Password reset email copy and public URL behaviour."""

from __future__ import annotations

from unittest.mock import patch

from app.features.auth.password_reset import _reset_url
from app.features.email.branding import ensure_public_email_url, public_email_url
from app.features.email.service import EmailService


def test_reset_url_uses_public_website() -> None:
    url = _reset_url("test-token-value-here", user_type="admin")
    assert url.startswith("https://www.eventtz.com/reset-password?portal=admin&token=")
    assert "localhost" not in url


def test_public_email_url_builds_admin_login() -> None:
    assert public_email_url("/admin/login") == "https://www.eventtz.com/admin/login"


def test_ensure_public_email_url_rewrites_localhost() -> None:
    rewritten = ensure_public_email_url(
        "http://localhost:3000/admin/reset-password?token=abc123",
    )
    assert rewritten == "https://www.eventtz.com/admin/reset-password?token=abc123"


def test_ensure_public_email_url_normalizes_apex() -> None:
    rewritten = ensure_public_email_url(
        "https://eventtz.com/reset-password?portal=admin&token=abc123",
    )
    assert rewritten == "https://www.eventtz.com/reset-password?portal=admin&token=abc123"


def test_send_password_reset_admin_setup_copy() -> None:
    svc = EmailService()
    with patch("app.features.email.service.resend_send", return_value=True) as mock_send:
        ok = svc.send_password_reset(
            to_email="admin@test.com",
            reset_url="https://www.eventtz.com/reset-password?portal=admin&token=abc",
            user_type="admin",
            purpose="setup",
        )
    assert ok is True
    _, kwargs = mock_send.call_args
    assert "Welcome to the admin team" in kwargs["subject"]
    assert "reset-password?portal=admin" in kwargs["html"]
    assert "token=abc" in kwargs["html"]
    assert "Set up password" in kwargs["html"]
    assert "localhost" not in kwargs["html"]


def test_send_password_reset_admin_reset_copy() -> None:
    svc = EmailService()
    with patch("app.features.email.service.resend_send", return_value=True) as mock_send:
        ok = svc.send_password_reset(
            to_email="admin@test.com",
            reset_url="https://eventtz.com/admin/reset-password?token=abc",
            user_type="admin",
            purpose="reset",
        )
    assert ok is True
    _, kwargs = mock_send.call_args
    assert "Reset your admin password" in kwargs["subject"]
    assert "Reset password" in kwargs["html"]
