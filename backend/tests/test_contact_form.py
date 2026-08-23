"""Tests for contact form submission."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.features.contact.classification import ContactClassification, classify_contact_message
from app.features.contact.service import submit_contact_message


@patch("app.features.contact.service.classify_contact_message", return_value="general")
@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
def test_submit_contact_message_persists_and_emails(
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
    mock_classify,
):
    mock_fetch_profile.return_value = {"email": "client@example.com"}

    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "x"}])

    result = submit_contact_message(
        user_id="user-1",
        portal="client",
        message="Hello support team, I need help please.",
        booking_id=None,
    )

    assert result["success"] is True
    mock_classify.assert_called_once_with(
        portal="client",
        message="Hello support team, I need help please.",
    )
    insert_row = client.table.return_value.insert.call_args.args[0]
    assert insert_row["subject"] == "General"
    mock_send_email.assert_called_once()
    mock_notify_cursor.assert_not_called()


@patch("app.features.contact.service.classify_contact_message", return_value="feedback_bug")
@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
def test_submit_contact_message_notifies_cursor_when_classified_as_bug(
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
    mock_classify,
):
    mock_fetch_profile.return_value = {"email": "client@example.com"}

    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "submission-123"}],
    )

    result = submit_contact_message(
        user_id="user-1",
        portal="client",
        message="The booking page shows a blank screen after login.",
        booking_id=None,
    )

    assert result["success"] is True
    mock_classify.assert_called_once()
    mock_notify_cursor.assert_called_once()
    call_kwargs = mock_notify_cursor.call_args.kwargs
    assert call_kwargs["submission_id"] == "submission-123"
    assert call_kwargs["subject_key"] == "feedback_bug"
    assert call_kwargs["portal"] == "client"


@patch("app.features.contact.service.classify_contact_message")
@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
def test_submit_contact_message_notifies_cursor_for_admin_bug_report(
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
    mock_classify,
):
    mock_fetch_profile.return_value = {"email": "ops@example.com"}

    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "admin-sub-1"}],
    )

    result = submit_contact_message(
        user_id="admin-1",
        portal="admin",
        subject="feedback_bug",
        message="The vendor directory table is blank after I change the date filter.",
        booking_id=None,
    )

    assert result["success"] is True
    mock_classify.assert_not_called()
    insert_row = client.table.return_value.insert.call_args.args[0]
    assert insert_row["portal"] == "admin"
    assert insert_row["subject"] == "Bug report"
    mock_notify_cursor.assert_called_once()
    assert mock_notify_cursor.call_args.kwargs["portal"] == "admin"
    assert mock_notify_cursor.call_args.kwargs["subject_key"] == "feedback_bug"


def test_submit_contact_message_rejects_short_message():
    with pytest.raises(ValueError, match="10 characters"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            message="short",
        )


@patch("app.features.contact.service.classify_contact_message", return_value="booking_problem")
@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
def test_submit_contact_message_allows_booking_subject_without_booking_id(
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
    mock_classify,
):
    mock_fetch_profile.return_value = {"email": "client@example.com"}
    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "x"}])

    result = submit_contact_message(
        user_id="user-1",
        portal="client",
        message="Something went wrong with my booking please help.",
        booking_id=None,
    )

    assert result["success"] is True
    insert_row = client.table.return_value.insert.call_args.args[0]
    assert insert_row["subject"] == "Booking problem"
    assert insert_row["booking_id"] is None
    mock_notify_cursor.assert_called_once()


@patch("app.features.contact.classification.parse_completion")
@patch("app.features.contact.classification.try_openai_client")
def test_classify_contact_message_uses_parse_completion(mock_try_client, mock_parse):
    mock_try_client.return_value = MagicMock()
    mock_parse.return_value = ContactClassification(
        subject="payments",
        rationale="User mentions a missing payout.",
    )

    subject = classify_contact_message(
        portal="vendor",
        message="My payout has not arrived after last week's booking.",
    )

    assert subject == "payments"
    mock_parse.assert_called_once()
    kwargs = mock_parse.call_args.kwargs
    assert kwargs["response_format"] is ContactClassification
    assert kwargs["log_context"] == "contact_classify"


@patch("app.features.contact.classification.try_openai_client", return_value=None)
def test_classify_contact_message_falls_back_when_openai_missing(mock_try_client):
    assert classify_contact_message(portal="client", message="Need help with something.") == "other"


@patch("app.features.contact.classification.parse_completion")
@patch("app.features.contact.classification.try_openai_client")
def test_classify_contact_message_falls_back_when_parse_fails(mock_try_client, mock_parse):
    mock_try_client.return_value = MagicMock()
    mock_parse.side_effect = HTTPException(status_code=503, detail="unavailable")

    assert classify_contact_message(portal="vendor", message="The app crashed when I saved.") == "other"


def test_submit_contact_message_rejects_invalid_subject():
    with pytest.raises(ValueError, match="valid topic"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="not_a_real_subject",
            message="Please help with this issue on my account.",
        )


def test_submit_contact_message_rejects_invalid_booking_uuid():
    with pytest.raises(ValueError, match="doesn't look right"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="booking_problem",
            message="Something went wrong with my booking please help.",
            booking_id="not-a-uuid",
        )


_BOOKING_ID = "11111111-1111-4111-8111-111111111111"


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
def test_submit_contact_message_rejects_unknown_booking(
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
):
    client = MagicMock()
    mock_get_client.return_value = client

    def table(name):
        t = MagicMock()
        if name == "booking_requests":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[],
            )
        return t

    client.table.side_effect = table
    with pytest.raises(ValueError, match="Booking not found"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="booking_problem",
            message="Something went wrong with my booking please help.",
            booking_id=_BOOKING_ID,
        )
    mock_notify_cursor.assert_not_called()
    mock_send_email.assert_not_called()


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
def test_submit_contact_message_rejects_booking_not_on_account(
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
):
    client = MagicMock()
    mock_get_client.return_value = client

    def table(name):
        t = MagicMock()
        if name == "booking_requests":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[
                    {
                        "id": _BOOKING_ID,
                        "client_user_id": "someone-else",
                        "vendor_user_id": "vendor-1",
                    }
                ],
            )
        return t

    client.table.side_effect = table
    with pytest.raises(ValueError, match="not on your account"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="booking_problem",
            message="Something went wrong with my booking please help.",
            booking_id=_BOOKING_ID,
        )
    mock_notify_cursor.assert_not_called()
    mock_send_email.assert_not_called()


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
@patch("app.features.contact.cursor_webhook.get_settings")
@patch("app.features.contact.cursor_webhook._webhook_executor")
def test_submit_contact_message_still_emails_when_webhook_dispatch_raises(
    mock_executor,
    mock_settings,
    mock_get_client,
    mock_fetch_profile,
    mock_send_email,
):
    mock_settings.return_value = MagicMock(
        cursor_automation_webhook_url="https://cursor.example/hook",
        cursor_automation_webhook_secret="",
    )
    mock_executor.submit.side_effect = RuntimeError("pool shut down")
    mock_fetch_profile.return_value = {"email": "client@example.com"}
    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "sub-1"}],
    )

    result = submit_contact_message(
        user_id="user-1",
        portal="client",
        subject="feedback_bug",
        message="The checkout button does nothing after I tap pay.",
        booking_id=None,
    )

    assert result["success"] is True
    mock_send_email.assert_called_once()


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
@patch("app.features.contact.cursor_webhook.get_settings")
@patch("app.features.contact.cursor_webhook.httpx.Client")
@patch("app.features.contact.cursor_webhook._webhook_executor")
def test_submit_contact_message_still_emails_when_webhook_http_fails(
    mock_executor,
    mock_httpx,
    mock_settings,
    mock_get_client,
    mock_fetch_profile,
    mock_send_email,
):
    mock_settings.return_value = MagicMock(
        cursor_automation_webhook_url="https://cursor.example/hook",
        cursor_automation_webhook_secret="secret",
    )
    mock_httpx.side_effect = RuntimeError("network down")

    def run_sync(fn, /, **kwargs):
        fn(**kwargs)
        return MagicMock()

    mock_executor.submit.side_effect = run_sync
    mock_fetch_profile.return_value = {"email": "client@example.com"}
    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "sub-1"}],
    )

    result = submit_contact_message(
        user_id="user-1",
        portal="client",
        subject="feedback_bug",
        message="The checkout button does nothing after I tap pay.",
        booking_id=None,
    )

    assert result["success"] is True
    mock_send_email.assert_called_once()
    mock_httpx.assert_called()
