"""Use cases for staff: list and inspect every review, and hide or unhide one."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import service as identity_service
from app.features.reviews import repository
from app.features.reviews.errors import ReviewNotFound
from app.features.reviews.rows import ReviewRow
from app.features.reviews.schemas import (
    AdminReviewDetailResponse,
    AdminReviewRow,
    AdminReviewsListResponse,
    ReviewVisibilityResponse,
)
from app.features.staff import service as staff_service
from app.features.vendors import service_listing as vendors_service

_DEFAULT_LIMIT = 100


def _admin_row(
    review: ReviewRow,
    *,
    vendor_display_name: str | None = None,
    client_email: str | None = None,
    booking_event_name: str | None = None,
    booking_event_date: str | None = None,
    booking_status: str | None = None,
) -> AdminReviewRow:
    """One review, in the shape the admin console reads."""
    return AdminReviewRow(
        id=review.id,
        booking_request_id=review.booking_request_id,
        vendor_user_id=review.vendor_user_id,
        client_user_id=review.client_user_id,
        rating=review.rating,
        body=review.body,
        hidden_at=review.hidden_at,
        created_at=review.created_at,
        vendor_display_name=vendor_display_name,
        client_email=client_email,
        booking_event_name=booking_event_name,
        booking_event_date=booking_event_date,
        booking_status=booking_status,
    )


async def list_reviews(
    session: AsyncSession, *, offset: int, limit: int, vendor_user_id: str | None
) -> AdminReviewsListResponse:
    """Every review, hidden ones included, most recent first, optionally filtered by vendor."""
    reviews, total = await repository.all_reviews_for_admin(
        session, offset=offset, limit=limit, vendor_user_id=vendor_user_id
    )
    vendor_display_names = await vendors_service.display_names(
        session, [review.vendor_user_id for review in reviews]
    )
    client_emails = await identity_service.emails_by_id(
        session, [review.client_user_id for review in reviews]
    )
    items = [
        _admin_row(
            review,
            vendor_display_name=vendor_display_names.get(review.vendor_user_id, "Vendor"),
            client_email=client_emails.get(review.client_user_id),
        )
        for review in reviews
    ]
    return AdminReviewsListResponse(reviews=items, total=total, offset=offset, limit=limit)


async def get_review(session: AsyncSession, review_id: str) -> AdminReviewDetailResponse:
    """One review with its booking's event name, date and status, for the moderation screen."""
    review = await repository.review_for_admin(session, review_id)
    if review is None:
        raise ReviewNotFound
    event_context = await repository.event_context_by_booking_id(session, [review.booking_request_id])
    booking_context = event_context.get(review.booking_request_id)
    vendor_display_names = await vendors_service.display_names(session, [review.vendor_user_id])
    client_emails = await identity_service.emails_by_id(session, [review.client_user_id])
    row = _admin_row(
        review,
        vendor_display_name=vendor_display_names.get(review.vendor_user_id, "Vendor"),
        client_email=client_emails.get(review.client_user_id),
        booking_event_name=booking_context.event_name if booking_context else None,
        booking_event_date=booking_context.event_date if booking_context else None,
        booking_status=booking_context.status if booking_context else None,
    )
    return AdminReviewDetailResponse(review=row)


async def set_visibility(
    session: AsyncSession, *, admin_user_id: str, review_id: str, hidden: bool
) -> ReviewVisibilityResponse:
    """Hide or unhide a review, and log the change.

    BASELINE QUIRK: `set_review_hidden` always returns `True` (an update that
    matches zero rows is not an error to supabase-py), so this succeeds even
    for a review id that does not exist - `COULD_NOT_UPDATE_REVIEW_VISIBILITY`
    is dead code on this path and is deliberately not reachable here either.
    """
    await repository.set_hidden(session, review_id, hidden=hidden)
    await staff_service.record_admin_action(
        session,
        admin_user_id=admin_user_id,
        action="review.hide" if hidden else "review.unhide",
        entity_type="booking_review",
        entity_id=review_id,
        details={"hidden": hidden},
    )
    return ReviewVisibilityResponse()
