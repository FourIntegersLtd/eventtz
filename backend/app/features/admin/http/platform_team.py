"""Admin console: team management and audit log."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_admin, require_super_admin
from app.contracts.admin import (
    AdminAuditLogDetailResponse,
    AdminAuditLogItem,
    AdminAuditLogResponse,
    AdminTeamInviteBody,
    AdminTeamInviteResponse,
    AdminTeamListResponse,
    AdminTeamMember,
    AdminTeamPatchBody,
)
from app.features.admin.audit import get_admin_audit_log_entry, insert_admin_audit_log, list_admin_audit_log
from app.features.admin.team_ops import invite_admin_colleague, list_admin_team, patch_admin_team_member

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/team", response_model=AdminTeamListResponse)
def admin_list_team(request: Request, response: Response) -> AdminTeamListResponse:
    require_admin(request, response)
    members = [AdminTeamMember.model_validate(m) for m in list_admin_team()]
    return AdminTeamListResponse(success=True, members=members)


@router.post("/team/invite", response_model=AdminTeamInviteResponse)
def admin_invite_team_member(
    body: AdminTeamInviteBody,
    request: Request,
    response: Response,
) -> AdminTeamInviteResponse:
    actor = require_super_admin(request, response)
    try:
        result = invite_admin_colleague(body.email, password=body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(actor.get("id") or ""),
        action="admin.invite",
        entity_type="user",
        entity_id=result.get("user_id"),
        payload={"email": result.get("email"), "created": result.get("created")},
    )
    return AdminTeamInviteResponse(**result)


@router.patch("/team/{user_id}", response_model=AdminTeamMember)
def admin_patch_team_member(
    user_id: str,
    body: AdminTeamPatchBody,
    request: Request,
    response: Response,
) -> AdminTeamMember:
    actor = require_super_admin(request, response)
    if not body.model_dump(exclude_unset=True):
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        row = patch_admin_team_member(
            user_id,
            admin_role=body.admin_role,
            account_suspended=body.account_suspended,
            actor_user_id=str(actor.get("id") or ""),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Admin not found")
    insert_admin_audit_log(
        admin_user_id=str(actor.get("id") or ""),
        action="admin.team_patch",
        entity_type="user",
        entity_id=user_id,
        payload=body.model_dump(exclude_unset=True),
    )
    return AdminTeamMember.model_validate(row)


@router.get("/audit-log", response_model=AdminAuditLogResponse)
def admin_audit_log(
    request: Request,
    response: Response,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    category: str = Query(
        "all",
        description="all | bookings | clients | vendors | disputes | reviews | chat | financials | team",
    ),
) -> AdminAuditLogResponse:
    require_admin(request, response)
    entries, total = list_admin_audit_log(offset=offset, limit=limit, category=category)
    items = [AdminAuditLogItem.model_validate(e) for e in entries]
    return AdminAuditLogResponse(success=True, entries=items, total=total)


@router.get("/audit-log/{entry_id}", response_model=AdminAuditLogDetailResponse)
def admin_audit_log_detail(
    entry_id: str,
    request: Request,
    response: Response,
) -> AdminAuditLogDetailResponse:
    require_admin(request, response)
    row = get_admin_audit_log_entry(entry_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit entry not found")
    return AdminAuditLogDetailResponse(success=True, entry=AdminAuditLogItem.model_validate(row))
