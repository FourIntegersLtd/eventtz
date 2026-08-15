"""Super-admin email health check and layout previews."""

from __future__ import annotations

from dataclasses import dataclass

from app.features.admin.messages import (
    EMAIL_NOT_SENT_CHECK_LOGS,
    INVALID_EMAIL_ADDRESS,
    UNKNOWN_EMAIL_TEMPLATE,
)
from app.features.email.service import get_email_service

DEFAULT_TEST_MESSAGE_BODY = (
    "This is a test email from Eventtz. If you received this, Resend delivery is working."
)

HEALTH_TEMPLATE_ID = "health"
LAYOUT_WELCOME = "layout.welcome"
LAYOUT_AUTH = "layout.auth"
LAYOUT_ADMIN = "layout.admin"


@dataclass(frozen=True)
class EmailTestTemplate:
    id: str
    label: str
    category: str
    description: str | None = None


def list_email_test_templates() -> list[EmailTestTemplate]:
    return [
        EmailTestTemplate(
            HEALTH_TEMPLATE_ID,
            "Health check (transactional)",
            "Recommended",
            "Quick Resend smoke test using the standard booking/support email layout.",
        ),
        EmailTestTemplate(
            LAYOUT_WELCOME,
            "Welcome (marketing)",
            "Layout preview",
            "Marketing welcome layout with your message as the intro.",
        ),
        EmailTestTemplate(
            LAYOUT_AUTH,
            "Auth (verify / reset style)",
            "Layout preview",
            "Password reset and email verification layout.",
        ),
        EmailTestTemplate(
            LAYOUT_ADMIN,
            "Admin alert",
            "Layout preview",
            "Internal ops alert layout.",
        ),
    ]


def _template_ids() -> set[str]:
    return {t.id for t in list_email_test_templates()}


def send_email_test(
    *,
    template_id: str,
    to_email: str,
    message_body: str | None = None,
    message_body_html: str | None = None,
) -> tuple[bool, str | None]:
    """Send a test email. Returns (delivered, message)."""
    tid = template_id.strip()
    if tid not in _template_ids():
        raise ValueError(UNKNOWN_EMAIL_TEMPLATE)

    email = to_email.strip().lower()
    if not email or "@" not in email:
        raise ValueError(INVALID_EMAIL_ADDRESS)

    layout = "health" if tid == HEALTH_TEMPLATE_ID else tid.removeprefix("layout.")

    ok = get_email_service().send_admin_email_test(
        to_email=email,
        layout=layout,
        message_body=(message_body or "").strip(),
        message_body_html=message_body_html,
    )
    return ok, None if ok else EMAIL_NOT_SENT_CHECK_LOGS
