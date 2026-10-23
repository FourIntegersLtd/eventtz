"""Admin console: `/admin/clients*` — the client directory and suspend/unsuspend toggle.

Both routes are open to any staff account, matching the baseline (unlike the
team console, whose mutations are super-admin-only).
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import PageDep
from app.core.ports import MailerDependency
from app.features.staff import service_clients
from app.features.staff.schemas import AdminClientsListResponse, AdminClientSuspendedBody, SuccessResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/clients", response_model=AdminClientsListResponse, responses=error_responses(*ROLE_ERRORS))
async def list_clients(
    session: SessionDep,
    principal: CurrentStaff,
    page: PageDep,
    search_email: str | None = Query(None, alias="q", max_length=200),
    suspended: bool | None = Query(None),
) -> AdminClientsListResponse:
    """A page of the client directory, optionally filtered by email search or suspension."""
    return await service_clients.list_clients(
        session, offset=page.offset, limit=page.limit, search_email=search_email, suspended=suspended
    )


@router.patch(
    "/clients/{user_id}/suspended", response_model=SuccessResponse, responses=error_responses(*ROLE_ERRORS)
)
async def set_client_suspended(
    user_id: str,
    body: AdminClientSuspendedBody,
    session: SessionDep,
    principal: CurrentStaff,
    mailer: MailerDependency,
) -> SuccessResponse:
    """Suspend or restore one client account."""
    return await service_clients.set_suspended(session, mailer, user_id, suspended=body.suspended)
