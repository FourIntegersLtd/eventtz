"""Admin console: disputes, reviews, and chat messages."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_admin
from app.features.admin.permissions import validate_dispute_patch_permissions
from app.contracts.admin import (
    AdminChatMessageItem,
    AdminConversationMessagesResponse,
    AdminDisputeCase,
    AdminDisputePatchBody,
    AdminDisputesListResponse,
    AdminReviewDetailResponse,
    AdminReviewRow,
    AdminReviewsListResponse,
    AdminReviewVisibilityBody,
)
from app.features.admin.audit import insert_admin_audit_log
from app.features.admin import (
    get_conversation_admin_meta,
    get_conversation_messages_admin,
    list_disputes_for_admin,
    list_reviews_for_admin,
    get_review_for_admin,
    patch_dispute_case,
    enrich_dispute_row,
    set_review_hidden,
)

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


@router.get("/disputes", response_model=AdminDisputesListResponse)
def admin_list_disputes(
    request: Request,
    response: Response,
    status: str = Query(
        "all",
        description="all | open (open+under_review) | under_review | resolved | closed",
    ),
) -> AdminDisputesListResponse:
    require_admin(request, response)
    try:
        rows = list_disputes_for_admin(status=status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
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
