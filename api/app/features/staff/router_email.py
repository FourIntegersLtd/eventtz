"""Admin console: `/admin/email/*` — the fixed test-send template list and the send action.

Both routes are super-admin-only: sending arbitrary test email is an
operational action, not a read any staff member should have.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentSuperAdmin
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency
from app.features.staff import service as staff
from app.features.staff import service_email
from app.features.staff.errors import InvalidEmailAddress, UnknownEmailTemplate
from app.features.staff.schemas import (
    AdminEmailTemplatesListResponse,
    AdminEmailTestSendBody,
    AdminEmailTestSendResponse,
)

router = APIRouter(prefix="/admin/email", tags=["admin"])


@router.get(
    "/templates", response_model=AdminEmailTemplatesListResponse, responses=error_responses(*ROLE_ERRORS)
)
async def list_templates(principal: CurrentSuperAdmin) -> AdminEmailTemplatesListResponse:
    """The fixed set of templates the test-send screen may choose from."""
    return service_email.list_templates()


@router.post(
    "/test-send",
    response_model=AdminEmailTestSendResponse,
    responses=error_responses(*ROLE_ERRORS, UnknownEmailTemplate, InvalidEmailAddress),
)
async def send_test(
    body: AdminEmailTestSendBody, session: SessionDep, principal: CurrentSuperAdmin, mailer: MailerDependency
) -> AdminEmailTestSendResponse:
    """Send one fixed test email, and log the attempt to the audit trail."""
    result = service_email.send_test(
        mailer,
        template_id=body.template_id,
        to_email=body.to_email,
        message_body=body.message_body,
        message_body_html=body.message_body_html,
    )
    await staff.record_admin_action(
        session,
        admin_user_id=principal.id,
        action="email.test_send",
        entity_type="email",
        entity_id=None,
        details={
            "to_email": body.to_email.strip().lower(),
            "delivered": result.delivered,
            "message_chars": len(body.message_body or ""),
        },
    )
    return result
