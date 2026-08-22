"""Tests for Cursor Automation webhook dispatch from contact submissions."""

from unittest.mock import MagicMock, patch

import pytest

from app.features.contact.cursor_webhook import (
    _post_cursor_webhook,
    notify_cursor_automation_for_contact,
    should_notify_cursor_automation,
)


def test_should_notify_cursor_automation_only_bug_subjects():
    assert should_notify_cursor_automation("feedback_bug") is True
    assert should_notify_cursor_automation("booking_problem") is True
    assert should_notify_cursor_automation("payments") is True
    assert should_notify_cursor_automation("general") is False
    assert should_notify_cursor_automation("feedback_feature") is False


@patch("app.features.contact.cursor_webhook.threading.Thread")
@patch("app.features.contact.cursor_webhook.get_settings")
def test_notify_skips_when_url_unset(mock_settings, mock_thread):
    mock_settings.return_value = MagicMock(
        cursor_automation_webhook_url="",
        cursor_automation_webhook_secret="",
    )
    notify_cursor_automation_for_contact(
        submission_id="sub-1",
        portal="client",
        user_id="user-1",
        subject_key="feedback_bug",
        subject_label="Bug report",
        message="Something broke on checkout.",
        booking_id=None,
        user_email="client@example.com",
    )
    mock_thread.assert_not_called()


@patch("app.features.contact.cursor_webhook.threading.Thread")
@patch("app.features.contact.cursor_webhook.get_settings")
def test_notify_starts_background_thread_when_url_set(mock_settings, mock_thread):
    mock_settings.return_value = MagicMock(
        cursor_automation_webhook_url="https://cursor.example/hook",
        cursor_automation_webhook_secret="secret-key",
    )
    notify_cursor_automation_for_contact(
        submission_id="sub-1",
        portal="vendor",
        user_id="user-2",
        subject_key="payments",
        subject_label="Payments",
        message="Payment did not complete after checkout.",
        booking_id="booking-uuid",
        user_email=None,
    )
    mock_thread.assert_called_once()
    kwargs = mock_thread.call_args.kwargs
    assert kwargs["daemon"] is True
    post_kwargs = kwargs["kwargs"]
    assert post_kwargs["url"] == "https://cursor.example/hook"
    assert post_kwargs["secret"] == "secret-key"
    assert post_kwargs["payload"]["source"] == "eventtz_contact"
    assert post_kwargs["payload"]["submission_id"] == "sub-1"
    assert post_kwargs["payload"]["booking_id"] == "booking-uuid"


@patch("app.features.contact.cursor_webhook.httpx.Client")
def test_post_cursor_webhook_sends_bearer_when_secret_set(mock_client_cls):
    client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = client
    client.post.return_value = MagicMock(status_code=200, text="ok")

    _post_cursor_webhook(
        url="https://cursor.example/hook",
        secret="abc",
        payload={"source": "eventtz_contact"},
    )

    client.post.assert_called_once()
    _, kwargs = client.post.call_args
    assert kwargs["headers"]["Authorization"] == "Bearer abc"
    assert kwargs["json"]["source"] == "eventtz_contact"


@patch("app.features.contact.cursor_webhook.httpx.Client")
def test_post_cursor_webhook_logs_http_errors(mock_client_cls):
    client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = client
    client.post.return_value = MagicMock(status_code=500, text="error")

    _post_cursor_webhook(
        url="https://cursor.example/hook",
        secret="",
        payload={},
    )

    client.post.assert_called_once()
