"""Vendor route: the signed-in vendor's own reviews list."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.features.reviews import service_vendor
from app.features.reviews.schemas import VendorOwnerReviewsResponse

router = APIRouter(prefix="/vendor", tags=["vendor"])


@router.get(
    "/reviews",
    response_model=VendorOwnerReviewsResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_own_reviews(
    session: SessionDep,
    principal: CurrentVendor,
    min_rating: Annotated[int | None, Query(ge=1, le=5)] = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=100),
) -> VendorOwnerReviewsResponse:
    """The caller's visible reviews, matching what shows on their public profile."""
    return await service_vendor.list_own_reviews(
        session,
        vendor_user_id=principal.id,
        min_rating=min_rating,
        offset=offset,
        limit=limit,
    )
