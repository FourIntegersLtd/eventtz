"""Client routes: submit a review, list the client's own reviews."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentClient
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.features.reviews import service_client
from app.features.reviews.errors import (
    ReviewAlreadySubmitted,
    ReviewBookingNotFound,
    ReviewOnlyAfterComplete,
    ReviewTooShort,
)
from app.features.reviews.schemas import (
    ClientOwnerReviewsResponse,
    PostBookingReviewBody,
    PostBookingReviewResponse,
)

router = APIRouter(prefix="/client", tags=["client"])

_SUBMIT_REVIEW_ERRORS = (
    *ROLE_ERRORS,
    ReviewBookingNotFound,
    ReviewOnlyAfterComplete,
    ReviewAlreadySubmitted,
    ReviewTooShort,
)


@router.post(
    "/booking-requests/{booking_id}/review",
    response_model=PostBookingReviewResponse,
    responses=error_responses(*_SUBMIT_REVIEW_ERRORS),
)
async def submit_review(
    session: SessionDep, principal: CurrentClient, booking_id: str, body: PostBookingReviewBody
) -> PostBookingReviewResponse:
    """Leave a rating and comment on a booking of the caller's own that has completed."""
    return await service_client.submit_review(
        session, client_user_id=principal.id, booking_id=booking_id, body=body
    )


@router.get(
    "/reviews",
    response_model=ClientOwnerReviewsResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_own_reviews(session: SessionDep, principal: CurrentClient) -> ClientOwnerReviewsResponse:
    """Every review the caller has submitted."""
    return await service_client.list_own_reviews(session, client_user_id=principal.id)
