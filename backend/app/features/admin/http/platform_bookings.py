"""Admin console: booking list, detail, and recovery actions."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_admin, require_super_admin
from app.contracts.admin import (
    AdminBookingDetailResponse,
    AdminBookingPaymentPatchBody,
    AdminCancelOnBehalfBody,
    AdminConfirmCompletionBody,
    AdminSupportHoldBody,
    AdminBookingsListResponse,
    AdminBookingListItem,
)
from app.features.admin.audit import insert_admin_audit_log
from app.features.admin.booking_recovery import (
    admin_cancel_booking_on_behalf,
    admin_clear_checkout_session,
    admin_complete_cancellation,
    admin_confirm_completion_for_party,
    admin_retry_payout_for_booking,
    admin_run_booking_maintenance,
    admin_set_support_hold,
    admin_sync_payment_for_booking,
)
from app.features.admin import (
    get_booking_detail_for_admin,
    list_bookings_for_admin,
    patch_booking_payment_fields,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/bookings", response_model=AdminBookingsListResponse)
def admin_list_bookings(
    request: Request,
    response: Response,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    needs_attention: bool = Query(False),
) -> AdminBookingsListResponse:
    require_admin(request, response)
    rows, total = list_bookings_for_admin(
        offset=offset,
        limit=limit,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
        needs_attention=needs_attention,
    )
    items = [AdminBookingListItem.model_validate(r) for r in rows]
    return AdminBookingsListResponse(
        success=True,
        bookings=items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/bookings/{booking_id}", response_model=AdminBookingDetailResponse)
def admin_get_booking(
    booking_id: str,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_admin(request, response)
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.view",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={},
    )
    return AdminBookingDetailResponse(success=True, booking=row)


@router.patch("/bookings/{booking_id}/payment-fields")
def admin_patch_booking_payment_fields(
    booking_id: str,
    body: AdminBookingPaymentPatchBody,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    user = require_super_admin(request, response)
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        ok = patch_booking_payment_fields(booking_id, patch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not ok:
        raise HTTPException(status_code=400, detail="Could not update payment fields")
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.payment_fields.patch",
        entity_type="booking_request",
        entity_id=booking_id,
        payload=patch,
    )
    return {"success": True}


@router.post("/bookings/{booking_id}/sync-payment", response_model=AdminBookingDetailResponse)
def admin_sync_booking_payment(
    booking_id: str,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_sync_payment_for_booking(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.sync_payment",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.post("/bookings/{booking_id}/reset-checkout", response_model=AdminBookingDetailResponse)
def admin_reset_booking_checkout(
    booking_id: str,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_clear_checkout_session(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.reset_checkout",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.post("/bookings/{booking_id}/release-payout", response_model=AdminBookingDetailResponse)
def admin_release_booking_payout(
    booking_id: str,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_retry_payout_for_booking(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.release_payout",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.post("/bookings/{booking_id}/retry-payout", response_model=AdminBookingDetailResponse)
def admin_retry_booking_payout(
    booking_id: str,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_retry_payout_for_booking(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.retry_payout",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.post("/bookings/{booking_id}/complete-cancellation", response_model=AdminBookingDetailResponse)
def admin_complete_booking_cancellation(
    booking_id: str,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_complete_cancellation(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.complete_cancellation",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.post("/bookings/{booking_id}/cancel-on-behalf", response_model=AdminBookingDetailResponse)
def admin_cancel_booking_on_behalf_route(
    booking_id: str,
    body: AdminCancelOnBehalfBody,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_cancel_booking_on_behalf(
            booking_id,
            party=body.party,
            reason=body.reason.strip(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.cancel_on_behalf",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={"party": body.party, "reason": body.reason.strip()},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.post("/bookings/{booking_id}/confirm-completion", response_model=AdminBookingDetailResponse)
def admin_confirm_booking_completion(
    booking_id: str,
    body: AdminConfirmCompletionBody,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_confirm_completion_for_party(booking_id, party=body.party)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.confirm_completion",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={"party": body.party},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.post("/bookings/{booking_id}/run-maintenance", response_model=AdminBookingDetailResponse)
def admin_run_booking_maintenance_route(
    booking_id: str,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_run_booking_maintenance(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.run_maintenance",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)


@router.patch("/bookings/{booking_id}/support-hold", response_model=AdminBookingDetailResponse)
def admin_patch_booking_support_hold(
    booking_id: str,
    body: AdminSupportHoldBody,
    request: Request,
    response: Response,
) -> AdminBookingDetailResponse:
    user = require_super_admin(request, response)
    try:
        admin_set_support_hold(booking_id, hold=body.hold)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="booking.support_hold",
        entity_type="booking_request",
        entity_id=booking_id,
        payload={"hold": body.hold},
    )
    row = get_booking_detail_for_admin(booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return AdminBookingDetailResponse(success=True, booking=row)
