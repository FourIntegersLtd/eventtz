"""Admin-only: list vendors and set approval status."""

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_admin, require_super_admin
from app.core.logging import get_logger
from app.contracts.disputes import AdminVendorInsightsResponse
from app.contracts.vendor import (
    AdminVendorApprovalBody,
    AdminVendorApprovalResponse,
    AdminVendorsListResponse,
)
from app.features.admin.audit import insert_admin_audit_log
from app.features.vendors.moderation import (
    get_vendor_admin_insights,
    list_vendors_for_admin,
    set_vendor_approval,
)

router = APIRouter(prefix="/admin", tags=["admin"])
logger = get_logger(__name__)


@router.get("/vendors", response_model=AdminVendorsListResponse)
def admin_list_vendors(
    request: Request,
    response: Response,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, max_length=200),
    approval_status: str | None = Query(None),
    status: str | None = Query(None),
) -> AdminVendorsListResponse:
    user = require_admin(request, response)
    rows, total = list_vendors_for_admin(
        offset=offset,
        limit=limit,
        q=q,
        approval_status=approval_status,
        status=status,
    )
    logger.info(
        "GET /admin/vendors admin_user_id=%s vendors_count=%s total=%s",
        user.get("id"),
        len(rows),
        total,
    )
    return AdminVendorsListResponse(
        success=True,
        vendors=rows,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/vendors/{user_id}/insights", response_model=AdminVendorInsightsResponse)
def admin_vendor_insights(
    user_id: str,
    request: Request,
    response: Response,
) -> AdminVendorInsightsResponse:
    require_admin(request, response)
    data = get_vendor_admin_insights(user_id)
    return AdminVendorInsightsResponse(
        success=True,
        user_id=str(data.get("user_id") or user_id),
        review_average=data.get("review_average"),
        review_count=int(data.get("review_count") or 0),
        bookings_total=int(data.get("bookings_total") or 0),
        bookings_by_status=dict(data.get("bookings_by_status") or {}),
        open_disputes_on_bookings=int(data.get("open_disputes_on_bookings") or 0),
        explore_path=str(data.get("explore_path") or ""),
    )


@router.patch("/vendors/{user_id}/approval", response_model=AdminVendorApprovalResponse)
def admin_set_vendor_approval(
    user_id: str,
    body: AdminVendorApprovalBody,
    request: Request,
    response: Response,
) -> AdminVendorApprovalResponse:
    user = require_admin(request, response)
    logger.info(
        "PATCH /admin/vendors/%s/approval admin_user_id=%s next_status=%s",
        user_id,
        user.get("id"),
        body.approval_status,
    )
    try:
        row = set_vendor_approval(user_id, body.approval_status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="vendor.approval",
        entity_type="vendor",
        entity_id=user_id,
        payload={
            "approval_status": row.get("approval_status", body.approval_status),
        },
    )
    return AdminVendorApprovalResponse(
        success=True,
        user_id=user_id,
        approval_status=row.get("approval_status", body.approval_status),
    )
