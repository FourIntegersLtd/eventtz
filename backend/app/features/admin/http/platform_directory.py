"""Admin console: client directory and search."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_admin
from app.contracts.admin import (
    AdminClientSuspendedBody,
    AdminClientsListResponse,
    AdminClientRow,
    AdminDirectorySearchResponse,
    AdminDirectoryUserRow,
)
from app.features.admin.audit import insert_admin_audit_log
from app.features.admin import list_clients_for_admin, set_client_suspended
from app.features.admin.directory_search import search_directory_users_for_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/clients", response_model=AdminClientsListResponse)
def admin_list_clients(
    request: Request,
    response: Response,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, max_length=200),
    suspended: bool | None = Query(None),
) -> AdminClientsListResponse:
    require_admin(request, response)
    rows, total = list_clients_for_admin(offset=offset, limit=limit, q=q, suspended=suspended)
    items = [AdminClientRow.model_validate(r) for r in rows]
    return AdminClientsListResponse(
        success=True,
        clients=items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/directory/search", response_model=AdminDirectorySearchResponse)
def admin_directory_search(
    request: Request,
    response: Response,
    q: str = Query(..., min_length=1, max_length=200),
    kinds: str = Query(
        "client,vendor",
        description="Comma-separated: client and/or vendor",
    ),
    limit: int = Query(20, ge=1, le=50),
) -> AdminDirectorySearchResponse:
    """Typeahead for admin recipient pickers — prefer over loading full client/vendor lists."""
    require_admin(request, response)
    kind_list = []
    for part in kinds.split(","):
        k = part.strip().lower()
        if k in ("client", "clients"):
            kind_list.append("client")
        elif k in ("vendor", "vendors"):
            kind_list.append("vendor")
    if not kind_list:
        kind_list = ["client", "vendor"]
    rows = search_directory_users_for_admin(q=q, kinds=kind_list, limit=limit)  # type: ignore[arg-type]
    return AdminDirectorySearchResponse(
        users=[AdminDirectoryUserRow.model_validate(r) for r in rows],
    )


@router.patch("/clients/{user_id}/suspended")
def admin_set_client_suspended(
    user_id: str,
    body: AdminClientSuspendedBody,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    user = require_admin(request, response)
    ok = set_client_suspended(user_id, body.suspended)
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Could not update suspension (migration or user missing).",
        )
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="client.suspend" if body.suspended else "client.unsuspend",
        entity_type="user",
        entity_id=user_id,
        payload={"suspended": body.suspended},
    )
    return {"success": True}
