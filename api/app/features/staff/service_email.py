"""Use cases behind `/admin/email/*`: the fixed template list and the test-send action.

Mirrors `backend/app/features/admin/email_test.py`. The baseline renders a
Supabase-specific "layout" preview; the rebuild instead sends the closest real
transactional email each template stands in for, which is enough to prove the
mailer adapter and template rendering both work end to end.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.ports import Mailer, OutgoingEmail
from app.features.staff.errors import InvalidEmailAddress, UnknownEmailTemplate
from app.features.staff.schemas import (
    AdminEmailTemplateRow,
    AdminEmailTemplatesListResponse,
    AdminEmailTestSendResponse,
)


@dataclass(frozen=True)
class _EmailTestTemplate:
    """One entry of the fixed test-send template catalogue."""

    id: str
    label: str
    category: str
    description: str | None = None


_TEMPLATES: tuple[_EmailTestTemplate, ...] = (
    _EmailTestTemplate(
        id="health", label="Health check", category="system", description="A minimal test email."
    ),
    _EmailTestTemplate(
        id="layout.welcome",
        label="Welcome layout",
        category="layout",
        description="The welcome email layout.",
    ),
    _EmailTestTemplate(
        id="layout.auth",
        label="Auth layout",
        category="layout",
        description="The sign-in/reset email layout.",
    ),
    _EmailTestTemplate(
        id="layout.admin",
        label="Admin layout",
        category="layout",
        description="The staff alert email layout.",
    ),
)
_TEMPLATE_IDS = {template.id for template in _TEMPLATES}


def list_templates() -> AdminEmailTemplatesListResponse:
    """The fixed set of templates the test-send screen may choose from."""
    return AdminEmailTemplatesListResponse(
        templates=[
            AdminEmailTemplateRow(
                id=template.id,
                label=template.label,
                category=template.category,
                description=template.description,
            )
            for template in _TEMPLATES
        ]
    )


def _looks_like_email(value: str) -> bool:
    """The same loose check the team console uses: trimmed and containing an `@`."""
    return bool(value.strip()) and "@" in value


def send_test(
    mailer: Mailer,
    *,
    template_id: str,
    to_email: str,
    message_body: str | None,
    message_body_html: str | None,
) -> AdminEmailTestSendResponse:
    """Send one fixed test email so staff can confirm the mailer adapter is wired up."""
    trimmed_id = template_id.strip()
    if trimmed_id not in _TEMPLATE_IDS:
        raise UnknownEmailTemplate()
    email = to_email.strip().lower()
    if not _looks_like_email(email):
        raise InvalidEmailAddress()
    fallback_text = "This is a test email from the Eventtz admin console."
    delivered = mailer.send(
        OutgoingEmail(
            to=(email,),
            subject=f"Eventtz admin test email — {trimmed_id}",
            html=message_body_html or f"<p>{message_body or fallback_text}</p>",
            text=message_body or fallback_text,
        )
    )
    return AdminEmailTestSendResponse(success=delivered, delivered=delivered)
