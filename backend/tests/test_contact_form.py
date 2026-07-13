"""Tests for contact form submission."""

from unittest.mock import MagicMock, patch

import pytest

from app.features.contact.service import submit_contact_message


@patch("app.features.contact.service.send_admin_contact_submitted_email")
@patch("app.features.contact.service.fetch_user_profile")
@patch("app.features.contact.service.get_client")
@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_persists_and_emails(
    mock_settings,
    mock_get_client,
    mock_fetch_profile,
    mock_send_email,
):
    mock_settings.return_value.local_auth_mode = False
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


@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_rejects_short_message(mock_settings):
    mock_settings.return_value.local_auth_mode = False
    with pytest.raises(ValueError, match="10 characters"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="general",
            message="short",
        )


@patch("app.features.contact.service.get_settings")
def test_submit_contact_message_requires_booking_for_booking_subject(mock_settings):
    mock_settings.return_value.local_auth_mode = False
    with pytest.raises(ValueError, match="booking id"):
        submit_contact_message(
            user_id="user-1",
            portal="client",
            subject="booking_problem",
            message="Something went wrong with my booking please help.",
        )
