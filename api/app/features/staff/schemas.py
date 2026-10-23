"""Request and response bodies for the staff slice's routes.

Shapes mirror the baseline's `app/contracts/admin.py` and `admin_email.py`
field-for-field, so the web app (still reading the baseline's OpenAPI schema
until cutover) needs no changes when these routes replace it.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.pagination import PagedResponse


class SuccessResponse(BaseModel):
    """The bare `{"success": true}` a few mutating routes answer with."""

    success: bool = True


# --- team ---------------------------------------------------------------------------------------


class AdminTeamMember(BaseModel):
    """One row of the team roster."""

    user_id: str
    email: str | None = None
    admin_role: Literal["super_admin", "admin"] = "admin"
    created_at: str | None = None
    account_suspended: bool = False


class AdminTeamListResponse(PagedResponse):
    """`GET /admin/team`."""

    success: bool = True
    members: list[AdminTeamMember]


class AdminTeamInviteBody(BaseModel):
    """`POST /admin/team/invite`. An omitted `password` sends a setup link instead."""

    email: str = Field(min_length=3, max_length=320)
    password: str | None = Field(default=None, min_length=6, max_length=128)


class AdminTeamInviteResponse(BaseModel):
    """`POST /admin/team/invite`."""

    success: bool = True
    user_id: str
    email: str
    admin_role: Literal["super_admin", "admin"] = "admin"
    created: bool = False
    invite_link_sent: bool = False
    message: str


class AdminTeamPatchBody(BaseModel):
    """`PATCH /admin/team/{user_id}`. At least one field must be set."""

    admin_role: Literal["super_admin", "admin"] | None = None
    account_suspended: bool | None = None


class AdminTeamDeleteResponse(BaseModel):
    """`DELETE /admin/team/{user_id}`."""

    success: bool = True
    user_id: str
    email: str | None = None
    deleted: bool = False
    demoted_to: Literal["client", "vendor"] | None = None
    message: str


class AdminTeamSendResetLinkResponse(BaseModel):
    """`POST /admin/team/{user_id}/send-reset-link`."""

    success: bool = True
    user_id: str
    email: str
    message: str


# --- clients --------------------------------------------------------------------------------------


class AdminClientRow(BaseModel):
    """One row of the client directory."""

    user_id: str
    email: str | None = None
    created_at: str | None = None
    account_suspended: bool = False
    booking_count: int = 0


class AdminClientsListResponse(PagedResponse):
    """`GET /admin/clients`."""

    success: bool = True
    clients: list[AdminClientRow]


class AdminClientSuspendedBody(BaseModel):
    """`PATCH /admin/clients/{user_id}/suspended`."""

    suspended: bool


# --- audit log ------------------------------------------------------------------------------------


class AdminAuditLogItem(BaseModel):
    """One entry of the audit trail."""

    id: str
    admin_user_id: str | None = None
    admin_email: str | None = None
    action: str
    entity_type: str
    entity_id: str | None = None
    audit_event_details: dict[str, Any] | None = None
    created_at: str | None = None


class AdminAuditLogResponse(BaseModel):
    """`GET /admin/audit-log`."""

    success: bool = True
    entries: list[AdminAuditLogItem]
    total: int = 0


class AdminAuditLogDetailResponse(BaseModel):
    """`GET /admin/audit-log/{entry_id}`."""

    success: bool = True
    entry: AdminAuditLogItem


# --- email test-send --------------------------------------------------------------------------------


class AdminEmailTemplateRow(BaseModel):
    """One entry of the fixed test-send template list."""

    id: str
    label: str
    category: str
    description: str | None = None


class AdminEmailTemplatesListResponse(BaseModel):
    """`GET /admin/email/templates`."""

    success: bool = True
    templates: list[AdminEmailTemplateRow]


class AdminEmailTestSendBody(BaseModel):
    """`POST /admin/email/test-send`."""

    template_id: str = Field(min_length=1, max_length=120)
    to_email: str = Field(min_length=3, max_length=320)
    message_body: str | None = Field(default=None, max_length=5000)
    message_body_html: str | None = Field(default=None, max_length=20000)


class AdminEmailTestSendResponse(BaseModel):
    """`POST /admin/email/test-send`."""

    success: bool
    delivered: bool
    message: str | None = None
