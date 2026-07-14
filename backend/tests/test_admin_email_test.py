"""Super-admin email template testing."""

from unittest.mock import patch

from app.features.admin.email_test import list_email_test_templates, send_email_test


def test_list_email_test_templates_includes_welcome_and_booking():
    templates = list_email_test_templates()
    ids = {t.id for t in templates}
    assert "welcome.client" in ids
    assert "welcome.vendor" in ids
    assert "booking.booking_accepted.client" in ids
    assert "admin.contact_submitted" in ids


@patch("app.features.admin.email_test.get_email_service")
def test_send_email_test_welcome_client(mock_get_svc):
    svc = mock_get_svc.return_value
    svc.send_welcome.return_value = True
    delivered, message = send_email_test(template_id="welcome.client", to_email="test@example.com")
    assert delivered is True
    assert message is None
    svc.send_welcome.assert_called_once_with(
        to_email="test@example.com",
        user_type="client",
        display_name="Ada",
    )


@patch("app.features.admin.email_test.get_email_service")
def test_send_email_test_unknown_template(mock_get_svc):
    mock_get_svc.return_value
    try:
        send_email_test(template_id="unknown.template", to_email="test@example.com")
        assert False, "expected ValueError"
    except ValueError as e:
        assert "Unknown" in str(e)
