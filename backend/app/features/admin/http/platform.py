"""Admin console: dashboard, bookings, financials, clients, disputes, reviews, chat, audit."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_admin, require_super_admin
from app.features.admin.permissions import validate_dispute_patch_permissions
from app.contracts.admin import (
    AdminAuditLogDetailResponse,
    AdminAuditLogItem,
    AdminAuditLogResponse,
    AdminBookingDetailResponse,
    AdminBookingPaymentPatchBody,
    AdminCancelOnBehalfBody,
    AdminConfirmCompletionBody,
    AdminSupportHoldBody,
    AdminBookingsListResponse,
    AdminBookingListItem,
    AdminChatMessageItem,
    AdminClientSuspendedBody,
    AdminClientsListResponse,
    AdminClientRow,
    AdminConversationMessagesResponse,
    AdminDashboardMetrics,
    AdminDashboardSummary,
    AdminDisputeCase,
    AdminDisputePatchBody,
    AdminDisputesListResponse,
    AdminFinancialsSummary,
    AdminReviewDetailResponse,
    AdminReviewRow,
    AdminReviewsListResponse,
    AdminTeamInviteBody,
    AdminTeamInviteResponse,
    AdminTeamListResponse,
    AdminTeamMember,
    AdminTeamPatchBody,
    AdminReviewVisibilityBody,
)
from app.features.admin.audit import get_admin_audit_log_entry, insert_admin_audit_log, list_admin_audit_log
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
    financials_export_csv_bytes,
    get_admin_dashboard_metrics,
    get_admin_dashboard_summary,
    get_booking_detail_for_admin,
    get_conversation_admin_meta,
    get_conversation_messages_admin,
    get_financials_summary,
    list_bookings_for_admin,
    list_clients_for_admin,
    list_disputes_for_admin,
    list_reviews_for_admin,
    get_review_for_admin,
    patch_booking_payment_fields,
    patch_dispute_case,
    enrich_dispute_row,
    set_client_suspended,
    set_review_hidden,
)
from app.features.admin.team_ops import invite_admin_colleague, list_admin_team, patch_admin_team_member

router = APIRouter(prefix="/admin", tags=["admin"])

_DISPUTE_STATUSES = frozenset({"open", "under_review", "resolved", "closed"})


def _normalize_dispute_status(raw: str) -> Literal["open", "under_review", "resolved", "closed"]:
    s = (raw or "open").strip().lower()
    if s in _DISPUTE_STATUSES:
        return s  # type: ignore[return-value]
    return "open"


def _opt_ts(v: Any) -> str | None:
    if v is None:
        return None
    return v if isinstance(v, str) else str(v)


def _dispute_row_to_model(row: dict[str, Any]) -> AdminDisputeCase:
    return AdminDisputeCase(
        id=str(row.get("id", "")),
        booking_request_id=str(row.get("booking_request_id", "")),
        opened_by_user_id=str(row.get("opened_by_user_id", "")),
        status=_normalize_dispute_status(str(row.get("status", "open"))),
        summary=str(row.get("summary", "")),
        internal_notes=row.get("internal_notes"),
        resolution_note=row.get("resolution_note"),
        assigned_admin_id=str(row["assigned_admin_id"])
        if row.get("assigned_admin_id")
        else None,
        assigned_admin_email=row.get("assigned_admin_email"),
        created_at=_opt_ts(row.get("created_at")),
        updated_at=_opt_ts(row.get("updated_at")),
        resolved_at=_opt_ts(row.get("resolved_at")),
        conversation_id=str(row["conversation_id"])
        if row.get("conversation_id")
        else None,
        resolution_action=row.get("resolution_action"),
        refund_amount_gbp=row.get("refund_amount_gbp"),
        event_name=row.get("event_name"),
        event_date=row.get("event_date"),
        booking_status=row.get("booking_status"),
        client_email=row.get("client_email"),
        vendor_display_name=row.get("vendor_display_name"),
        vendor_email=row.get("vendor_email"),
        opened_by_role=row.get("opened_by_role"),
        opened_by_email=row.get("opened_by_email"),
        opened_by_display_name=row.get("opened_by_display_name"),
    )


@router.get("/dashboard-summary", response_model=AdminDashboardSummary)
def admin_dashboard_summary(request: Request, response: Response) -> AdminDashboardSummary:
    require_admin(request, response)
    data = get_admin_dashboard_summary()
    return AdminDashboardSummary(**data)


@router.get("/dashboard-metrics", response_model=AdminDashboardMetrics)
def admin_dashboard_metrics(
    request: Request,
    response: Response,
    days: int = Query(30, ge=7, le=90),
) -> AdminDashboardMetrics:
    require_admin(request, response)
    allowed = 7 if days <= 7 else (30 if days <= 30 else 90)
    data = get_admin_dashboard_metrics(allowed)
    return AdminDashboardMetrics(**data)


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


@router.get("/financials/summary", response_model=AdminFinancialsSummary)
def admin_financials_summary(
    request: Request,
    response: Response,
    date_from: str | None = None,
    date_to: str | None = None,
) -> AdminFinancialsSummary:
    require_admin(request, response)
    data = get_financials_summary(date_from, date_to)
    return AdminFinancialsSummary(**data)


@router.get("/financials/export.csv")
def admin_financials_export(
    request: Request,
    response: Response,
    date_from: str | None = None,
    date_to: str | None = None,
) -> Response:
    user = require_super_admin(request, response)
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="financials.export_csv",
        entity_type="financials",
        entity_id=None,
        payload={"date_from": date_from, "date_to": date_to},
    )
    raw = financials_export_csv_bytes(date_from, date_to)
    return Response(
        content=raw,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="eventtz-financials.csv"',
        },
    )


@router.get("/clients", response_model=AdminClientsListResponse)
def admin_list_clients(request: Request, response: Response) -> AdminClientsListResponse:
    require_admin(request, response)
    rows = list_clients_for_admin()
    items = [AdminClientRow.model_validate(r) for r in rows]
    return AdminClientsListResponse(success=True, clients=items)


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


@router.get("/disputes", response_model=AdminDisputesListResponse)
def admin_list_disputes(request: Request, response: Response) -> AdminDisputesListResponse:
    require_admin(request, response)
    rows = list_disputes_for_admin()
    items = [_dispute_row_to_model(r) for r in rows]
    return AdminDisputesListResponse(success=True, disputes=items)


@router.patch("/disputes/{dispute_id}", response_model=AdminDisputeCase)
def admin_patch_dispute(
    dispute_id: str,
    body: AdminDisputePatchBody,
    request: Request,
    response: Response,
) -> AdminDisputeCase:
    user = require_admin(request, response)
    patch_fields = body.model_dump(exclude_unset=True)
    if not patch_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    validate_dispute_patch_permissions(user, patch_fields)
    try:
        row = patch_dispute_case(
            dispute_id,
            status=body.status,
            internal_notes=body.internal_notes,
            resolution_note=body.resolution_note,
            assigned_admin_id=body.assigned_admin_id,
            resolution_action=body.resolution_action,
            refund_amount_gbp=body.refund_amount_gbp,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Dispute not found")
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="dispute.patch",
        entity_type="dispute_case",
        entity_id=dispute_id,
        payload=body.model_dump(exclude_unset=True),
    )
    return _dispute_row_to_model(enrich_dispute_row(row))


@router.get("/reviews", response_model=AdminReviewsListResponse)
def admin_list_reviews(
    request: Request,
    response: Response,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    vendor_user_id: str | None = Query(None),
) -> AdminReviewsListResponse:
    require_admin(request, response)
    rows, total = list_reviews_for_admin(
        offset=offset,
        limit=limit,
        vendor_user_id=vendor_user_id,
    )
    items = [AdminReviewRow.model_validate(r) for r in rows]
    return AdminReviewsListResponse(
        success=True,
        reviews=items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/reviews/{review_id}", response_model=AdminReviewDetailResponse)
def admin_get_review(
    review_id: str,
    request: Request,
    response: Response,
) -> AdminReviewDetailResponse:
    require_admin(request, response)
    row = get_review_for_admin(review_id)
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
    return AdminReviewDetailResponse(
        success=True,
        review=AdminReviewRow.model_validate(row),
    )


@router.patch("/reviews/{review_id}/visibility")
def admin_review_visibility(
    review_id: str,
    body: AdminReviewVisibilityBody,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    user = require_admin(request, response)
    ok = set_review_hidden(review_id, body.hidden)
    if not ok:
        raise HTTPException(status_code=400, detail="Could not update review visibility")
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="review.hide" if body.hidden else "review.unhide",
        entity_type="booking_review",
        entity_id=review_id,
        payload={"hidden": body.hidden},
    )
    return {"success": True}


@router.get(
    "/chat/conversations/{conversation_id}/messages",
    response_model=AdminConversationMessagesResponse,
)
def admin_chat_messages(
    conversation_id: str,
    request: Request,
    response: Response,
) -> AdminConversationMessagesResponse:
    user = require_admin(request, response)
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="chat.view",
        entity_type="conversation",
        entity_id=conversation_id,
        payload={},
    )
    meta = get_conversation_admin_meta(conversation_id)
    msgs = get_conversation_messages_admin(conversation_id)
    items = [AdminChatMessageItem.model_validate(m) for m in msgs]
    return AdminConversationMessagesResponse(
        success=True,
        conversation_id=conversation_id,
        messages=items,
        client_user_id=meta.get("client_user_id"),
        vendor_user_id=meta.get("vendor_user_id"),
        client_email=meta.get("client_email"),
        vendor_display_name=meta.get("vendor_display_name"),
    )


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
) -> AdminAuditLogResponse:
    require_admin(request, response)
    entries, total = list_admin_audit_log(offset=offset, limit=limit)
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
