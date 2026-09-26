"""Staff routes: moderate reviews - list, inspect one, hide or unhide."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.features.reviews import service_admin
from app.features.reviews.errors import ReviewNotFound
from app.features.reviews.schemas import (
    AdminReviewDetailResponse,
    AdminReviewsListResponse,
    ReviewVisibilityBody,
    ReviewVisibilityResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/reviews",
    response_model=AdminReviewsListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_reviews(
    session: SessionDep,
    principal: CurrentStaff,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    vendor_user_id: str | None = Query(None),
) -> AdminReviewsListResponse:
    """Every review, hidden ones included, optionally narrowed to one vendor."""
    return await service_admin.list_reviews(
        session, offset=offset, limit=limit, vendor_user_id=vendor_user_id
    )


@router.get(
    "/reviews/{review_id}",
    response_model=AdminReviewDetailResponse,
    responses=error_responses(*ROLE_ERRORS, ReviewNotFound),
)
async def get_review(
    session: SessionDep, principal: CurrentStaff, review_id: str
) -> AdminReviewDetailResponse:
    """One review with its booking's event context, for the moderation screen."""
    return await service_admin.get_review(session, review_id)


@router.patch(
    "/reviews/{review_id}/visibility",
    response_model=ReviewVisibilityResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def set_review_visibility(
    session: SessionDep, principal: CurrentStaff, review_id: str, body: ReviewVisibilityBody
) -> ReviewVisibilityResponse:
    """Hide or unhide a review, logging the change to the admin audit log."""
    return await service_admin.set_visibility(
        session, admin_user_id=principal.id, review_id=review_id, hidden=body.hidden
    )
