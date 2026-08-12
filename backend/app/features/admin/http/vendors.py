"""Admin-only: list vendors and set approval status."""

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.admin.permissions import validate_listing_override_permissions
from app.features.auth.http.guards import require_admin, require_super_admin
from app.core.logging import get_logger
from app.contracts.disputes import AdminVendorInsightsResponse
from app.contracts.vendor import (
    AdminVendorApprovalBody,
    AdminVendorApprovalResponse,
    AdminVendorListingOverrideBody,
    AdminVendorListingOverrideResponse,
    AdminVendorProfileNudgeBody,
    AdminVendorProfileNudgeFailure,
    AdminVendorProfileNudgeResponse,
    AdminVendorRestoreStripeConnectResponse,
    AdminVendorUnsubmitBody,
    AdminVendorUnsubmitResponse,
    AdminVendorsListResponse,
)
from app.features.admin.audit import insert_admin_audit_log
from app.features.payments.stripe import restore_vendor_connect_from_payout_history
from app.features.vendors.moderation import (
    get_vendor_admin_insights,
    list_vendors_for_admin,
    nudge_draft_vendors_to_complete_profile,
    set_vendor_approval,
    set_vendor_listing_override,
    unsubmit_vendor_profile,
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
        bookings_by_month=list(data.get("bookings_by_month") or []),
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


@router.patch("/vendors/{user_id}/unsubmit", response_model=AdminVendorUnsubmitResponse)
def admin_unsubmit_vendor(
    user_id: str,
    body: AdminVendorUnsubmitBody,
    request: Request,
    response: Response,
) -> AdminVendorUnsubmitResponse:
    user = require_admin(request, response)
    logger.info(
        "PATCH /admin/vendors/%s/unsubmit admin_user_id=%s send_email=%s",
        user_id,
        user.get("id"),
        body.send_email,
    )
    try:
        row, email_sent = unsubmit_vendor_profile(
            user_id,
            send_email=body.send_email,
            admin_message=body.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    audit_payload: dict[str, object] = {
        "status": row.get("status", "draft"),
        "email_sent": email_sent,
    }
    if body.message and body.message.strip():
        audit_payload["message_preview"] = body.message.strip()[:200]
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="vendor.unsubmit",
        entity_type="vendor",
        entity_id=user_id,
        payload=audit_payload,
    )
    return AdminVendorUnsubmitResponse(
        success=True,
        user_id=user_id,
        status=row.get("status", "draft"),
        email_sent=email_sent,
    )


@router.post("/vendors/nudge-profile-complete", response_model=AdminVendorProfileNudgeResponse)
def admin_nudge_draft_vendors_profile(
    body: AdminVendorProfileNudgeBody,
    request: Request,
    response: Response,
) -> AdminVendorProfileNudgeResponse:
    user = require_admin(request, response)
    logger.info(
        "POST /admin/vendors/nudge-profile-complete admin_user_id=%s count=%s",
        user.get("id"),
        len(body.user_ids),
    )
    result = nudge_draft_vendors_to_complete_profile(body.user_ids)
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="vendor.profile_nudge",
        entity_type="vendor",
        entity_id=None,
        payload={
            "user_ids": body.user_ids[:20],
            "sent": result.get("sent", 0),
            "skipped": result.get("skipped", 0),
            "failure_count": len(result.get("failures") or []),
        },
    )
    failures = [
        AdminVendorProfileNudgeFailure(
            user_id=str(item.get("user_id") or ""),
            error=str(item.get("error") or ""),
        )
        for item in (result.get("failures") or [])
        if isinstance(item, dict)
    ]
    return AdminVendorProfileNudgeResponse(
        success=True,
        sent=int(result.get("sent") or 0),
        skipped=int(result.get("skipped") or 0),
        failures=failures,
    )


@router.patch(
    "/vendors/{user_id}/listing-override",
    response_model=AdminVendorListingOverrideResponse,
)
def admin_set_vendor_listing_override(
    user_id: str,
    body: AdminVendorListingOverrideBody,
    request: Request,
    response: Response,
) -> AdminVendorListingOverrideResponse:
    """Force an approved vendor's listing on or off, overriding the Stripe payout gate."""
    user = require_admin(request, response)
    validate_listing_override_permissions(user, body.listing_override)
    logger.info(
        "PATCH /admin/vendors/%s/listing-override admin_user_id=%s next_override=%s",
        user_id,
        user.get("id"),
        body.listing_override,
    )
    try:
        row = set_vendor_listing_override(
            user_id,
            body.listing_override,
            reason=body.reason,
            admin_user_id=str(user.get("id") or "") or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="vendor.listing_override",
        entity_type="vendor",
        entity_id=user_id,
        payload={
            "listing_override": body.listing_override,
            "reason": body.reason,
            "listing_visible": bool(row.get("listing_visible")),
        },
    )
    return AdminVendorListingOverrideResponse(
        success=True,
        user_id=user_id,
        listing_override=row.get("listing_override", body.listing_override),
        listing_visible=bool(row.get("listing_visible")),
    )


@router.post(
    "/vendors/{user_id}/restore-stripe-connect",
    response_model=AdminVendorRestoreStripeConnectResponse,
)
def admin_restore_vendor_stripe_connect(
    user_id: str,
    request: Request,
    response: Response,
) -> AdminVendorRestoreStripeConnectResponse:
    """Super admin: restore Connect account id from the vendor's latest payout transfer."""
    admin = require_super_admin(request, response)
    admin_id = str(admin.get("id") or "")
    try:
        result = restore_vendor_connect_from_payout_history(user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.warning("restore-stripe-connect failed vendor=%s: %s", user_id, e, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not restore Stripe Connect.") from e
    insert_admin_audit_log(
        admin_user_id=admin_id,
        action="vendor.stripe_connect_restored",
        entity_type="vendor",
        entity_id=user_id,
        payload={
            "stripe_account_id": result.get("stripe_account_id"),
            "restored_from_transfer_id": result.get("restored_from_transfer_id"),
        },
    )
    return AdminVendorRestoreStripeConnectResponse(
        success=True,
        user_id=user_id,
        stripe_account_id=result.get("stripe_account_id"),
        stripe_charges_enabled=bool(result.get("charges_enabled")),
        stripe_payouts_enabled=bool(result.get("payouts_enabled")),
        restored_from_transfer_id=result.get("restored_from_transfer_id"),
    )
