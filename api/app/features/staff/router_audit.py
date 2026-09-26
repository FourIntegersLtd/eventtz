"""Admin console: `/admin/audit-log*` — list and inspect one entry.

Open to any staff account: reading the trail is not a super-admin-only action,
only the actions it records (most of which are) are.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.features.staff import service as staff
from app.features.staff.errors import AuditEntryNotFound
from app.features.staff.schemas import AdminAuditLogDetailResponse, AdminAuditLogResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-log", response_model=AdminAuditLogResponse, responses=error_responses(*ROLE_ERRORS))
async def list_audit_log(
    session: SessionDep,
    principal: CurrentStaff,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    category: str = Query(
        "all",
        description="all | bookings | clients | vendors | disputes | reviews | chat | financials | team",
    ),
) -> AdminAuditLogResponse:
    """A page of the audit trail, most recent first, optionally narrowed to one category."""
    return await staff.list_audit_log(session, offset=offset, limit=limit, category=category)


@router.get(
    "/audit-log/{entry_id}",
    response_model=AdminAuditLogDetailResponse,
    responses=error_responses(*ROLE_ERRORS, AuditEntryNotFound),
)
async def get_audit_log_entry(
    entry_id: str, session: SessionDep, principal: CurrentStaff
) -> AdminAuditLogDetailResponse:
    """One audit entry by id."""
    return await staff.get_audit_log_entry(session, entry_id)
