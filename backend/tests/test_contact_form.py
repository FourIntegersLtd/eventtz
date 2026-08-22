"""Tests for contact form submission."""

from unittest.mock import MagicMock, patch

import pytest

from app.features.contact.service import submit_contact_message


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_persists_and_emails(
    mock_settings,
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
):
    mock_fetch_profile.return_value = {"email": "client@example.com"}

    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": "x"}])

    result = submit_contact_message(
        user_id="user-1",
        portal="client",
        subject="general",
        message="Hello support team, I need help please.",
        booking_id=None,
    )

    assert result["success"] is True
    client.table.assert_called_with("contact_submissions")
    mock_send_email.assert_called_once()
    mock_notify_cursor.assert_not_called()


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_notifies_cursor_for_bug_report(
    mock_settings,
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
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
        subject="feedback_bug",
        message="The booking page shows a blank screen after login.",
        booking_id=None,
    )

    assert result["success"] is True
    mock_notify_cursor.assert_called_once()
    call_kwargs = mock_notify_cursor.call_args.kwargs
    assert call_kwargs["submission_id"] == "submission-123"
    assert call_kwargs["subject_key"] == "feedback_bug"
    assert call_kwargs["portal"] == "client"


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.notify_cursor_automation_for_contact")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_db")
@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_notifies_cursor_for_admin_bug_report(
    mock_settings,
    mock_get_client,
    mock_fetch_profile,
    mock_notify_cursor,
    mock_send_email,
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
    insert_row = client.table.return_value.insert.call_args.args[0]
    assert insert_row["portal"] == "admin"
    assert insert_row["subject"] == "Bug report"
    mock_notify_cursor.assert_called_once()
    assert mock_notify_cursor.call_args.kwargs["portal"] == "admin"
    assert mock_notify_cursor.call_args.kwargs["subject_key"] == "feedback_bug"


@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_rejects_short_message(mock_settings):
    with pytest.raises(ValueError, match="10 characters"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="general",
            message="short",
        )


@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_requires_booking_for_booking_subject(mock_settings):
    with pytest.raises(ValueError, match="booking reference"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="booking_problem",
            message="Something went wrong with my booking please help.",
        )
