"""Super-admin email template testing."""

from unittest.mock import patch

from app.features.admin.email_test import (
    DEFAULT_TEST_MESSAGE_BODY,
    HEALTH_TEMPLATE_ID,
    LAYOUT_ADMIN,
    LAYOUT_AUTH,
    LAYOUT_WELCOME,
    list_email_test_templates,
    send_email_test,
)


def test_list_email_test_templates_is_small_curated_set():
    templates = list_email_test_templates()
    ids = {t.id for t in templates}
    assert ids == {HEALTH_TEMPLATE_ID, LAYOUT_WELCOME, LAYOUT_AUTH, LAYOUT_ADMIN}
    assert len(templates) == 4


@patch("app.features.admin.email_test.get_email_service")
def test_send_email_test_health_uses_custom_body(mock_get_svc):
    svc = mock_get_svc.return_value
    svc.send_admin_email_test.return_value = True
    delivered, message = send_email_test(
        template_id=HEALTH_TEMPLATE_ID,
        to_email="test@example.com",
        message_body="Hello vendors",
    )
    assert delivered is True
    assert message is None
    svc.send_admin_email_test.assert_called_once_with(
        to_email="test@example.com",
        layout="health",
        message_body="Hello vendors",
        message_body_html=None,
    )


@patch("app.features.admin.email_test.get_email_service")
def test_send_email_test_health_passes_html(mock_get_svc):
    svc = mock_get_svc.return_value
    svc.send_admin_email_test.return_value = True
    delivered, message = send_email_test(
        template_id=HEALTH_TEMPLATE_ID,
        to_email="test@example.com",
        message_body_html="<p>Hello <strong>vendors</strong></p>",
    )
    assert delivered is True
    assert message is None
    svc.send_admin_email_test.assert_called_once_with(
        to_email="test@example.com",
        layout="health",
        message_body="",
        message_body_html="<p>Hello <strong>vendors</strong></p>",
    )


@patch("app.features.admin.email_test.get_email_service")
def test_send_email_test_defaults_body_when_empty(mock_get_svc):
    svc = mock_get_svc.return_value
    svc.send_admin_email_test.return_value = True
    send_email_test(template_id=LAYOUT_AUTH, to_email="test@example.com", message_body="  ")
    svc.send_admin_email_test.assert_called_once_with(
        to_email="test@example.com",
        layout="auth",
        message_body="",
        message_body_html=None,
    )


@patch("app.features.admin.email_test.get_email_service")
def test_send_email_test_unknown_template(mock_get_svc):
    mock_get_svc.return_value
    try:
        send_email_test(template_id="booking.booking_accepted.client", to_email="test@example.com")
        assert False, "expected ValueError"
    except ValueError as e:
        assert "Unknown" in str(e)
