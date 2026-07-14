"""Super-admin email template testing."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.contracts.admin_email import (
    AdminEmailTemplateRow,
    AdminEmailTemplatesListResponse,
    AdminEmailTestSendBody,
    AdminEmailTestSendResponse,
)
from app.features.admin.audit import insert_admin_audit_log
from app.features.admin.email_test import list_email_test_templates, send_email_test
from app.features.auth.http.guards import require_super_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/email/templates", response_model=AdminEmailTemplatesListResponse)
def admin_email_templates_list(
    request: Request,
    response: Response,
) -> AdminEmailTemplatesListResponse:
    require_super_admin(request, response)
    templates = [
        AdminEmailTemplateRow(
            id=t.id,
            label=t.label,
            category=t.category,
            description=t.description,
        )
        for t in list_email_test_templates()
    ]
    return AdminEmailTemplatesListResponse(templates=templates)


@router.post("/email/test-send", response_model=AdminEmailTestSendResponse)
def admin_email_test_send(
    request: Request,
    response: Response,
    body: AdminEmailTestSendBody,
) -> AdminEmailTestSendResponse:
    admin = require_super_admin(request, response)
    admin_id = str(admin.get("id") or "")

    try:
        delivered, message = send_email_test(
            template_id=body.template_id,
            to_email=body.to_email,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    insert_admin_audit_log(
        admin_user_id=admin_id,
        action="email.test_send",
        entity_type="email_template",
        entity_id=body.template_id.strip(),
        payload={
            "to_email": body.to_email.strip().lower(),
            "delivered": delivered,
        },
    )

    if not delivered:
        return AdminEmailTestSendResponse(
            success=False,
            delivered=False,
            message=message or "Email was not sent. Check RESEND_API_KEY and server logs.",
        )

    return AdminEmailTestSendResponse(
        success=True,
        delivered=True,
        message=f"Sent to {body.to_email.strip().lower()}.",
    )
