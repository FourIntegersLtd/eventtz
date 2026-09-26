"""Admin console: `/admin/team*` — list, invite, patch, delete, send a reset link.

Viewing the roster is open to any staff account; every mutation is
super-admin-only (`CurrentSuperAdmin`).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentStaff, CurrentSuperAdmin
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency
from app.features.staff import service as staff
from app.features.staff import service_team
from app.features.staff.errors import (
    AdminUserNotFound,
    CannotDeleteLastSuperAdmin,
    CannotDeleteSelf,
    CannotDemoteLastSuperAdmin,
    CannotDemoteSelf,
    CannotSuspendSelf,
    InvalidEmailAddress,
    NoFieldsToUpdate,
)
from app.features.staff.schemas import (
    AdminTeamDeleteResponse,
    AdminTeamInviteBody,
    AdminTeamInviteResponse,
    AdminTeamListResponse,
    AdminTeamMember,
    AdminTeamPatchBody,
    AdminTeamSendResetLinkResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/team", response_model=AdminTeamListResponse, responses=error_responses(*ROLE_ERRORS))
async def list_team(session: SessionDep, principal: CurrentStaff) -> AdminTeamListResponse:
    """Every admin account, for the team roster screen."""
    return await service_team.list_team(session)


@router.post(
    "/team/invite",
    response_model=AdminTeamInviteResponse,
    responses=error_responses(*ROLE_ERRORS, InvalidEmailAddress),
)
async def invite_team_member(
    body: AdminTeamInviteBody, session: SessionDep, principal: CurrentSuperAdmin, mailer: MailerDependency
) -> AdminTeamInviteResponse:
    """Create, promote or top up the password of an admin account, by email."""
    result = await service_team.invite(session, mailer, email=body.email, password=body.password)
    await staff.record_admin_action(
        session,
        admin_user_id=principal.id,
        action="admin.invite",
        entity_type="user",
        entity_id=result.user_id,
        details={
            "email": result.email,
            "created": result.created,
            "invite_link_sent": result.invite_link_sent,
        },
    )
    return result


@router.post(
    "/team/{user_id}/send-reset-link",
    response_model=AdminTeamSendResetLinkResponse,
    responses=error_responses(*ROLE_ERRORS, AdminUserNotFound),
)
async def send_reset_link(
    user_id: str, session: SessionDep, principal: CurrentSuperAdmin, mailer: MailerDependency
) -> AdminTeamSendResetLinkResponse:
    """Email an existing admin a fresh password-reset link."""
    result = await service_team.send_reset_link(session, mailer, user_id)
    await staff.record_admin_action(
        session,
        admin_user_id=principal.id,
        action="admin.password_reset_sent",
        entity_type="user",
        entity_id=user_id,
        details={"email": result.email},
    )
    return result


@router.delete(
    "/team/{user_id}",
    response_model=AdminTeamDeleteResponse,
    responses=error_responses(*ROLE_ERRORS, AdminUserNotFound, CannotDeleteSelf, CannotDeleteLastSuperAdmin),
)
async def delete_team_member(
    user_id: str, session: SessionDep, principal: CurrentSuperAdmin
) -> AdminTeamDeleteResponse:
    """Remove an admin from the team, or demote them if something else references the account."""
    result = await service_team.delete_member(session, principal, user_id)
    await staff.record_admin_action(
        session,
        admin_user_id=principal.id,
        action="admin.team_delete",
        entity_type="user",
        entity_id=user_id,
        details={"email": result.email, "deleted": result.deleted, "demoted_to": result.demoted_to},
    )
    return result


@router.patch(
    "/team/{user_id}",
    response_model=AdminTeamMember,
    responses=error_responses(
        *ROLE_ERRORS,
        NoFieldsToUpdate,
        AdminUserNotFound,
        CannotDemoteSelf,
        CannotSuspendSelf,
        CannotDemoteLastSuperAdmin,
    ),
)
async def patch_team_member(
    user_id: str, body: AdminTeamPatchBody, session: SessionDep, principal: CurrentSuperAdmin
) -> AdminTeamMember:
    """Change an admin's role and/or suspension flag."""
    if not body.model_dump(exclude_unset=True):
        raise NoFieldsToUpdate()
    result = await service_team.patch_member(session, principal, user_id, body)
    await staff.record_admin_action(
        session,
        admin_user_id=principal.id,
        action="admin.team_patch",
        entity_type="user",
        entity_id=user_id,
        details=body.model_dump(exclude_unset=True),
    )
    return result
