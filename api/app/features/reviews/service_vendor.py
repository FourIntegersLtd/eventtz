"""Use case for a signed-in vendor: their own reviews list, matching their public profile."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import service as identity_service
from app.features.reviews import repository
from app.features.reviews.domain import reviewer_display_from_email
from app.features.reviews.schemas import VendorOwnerReviewItem, VendorOwnerReviewsResponse

# Matches the baseline's `list_reviews_for_vendor_owner` cap.
_VENDOR_REVIEWS_LIMIT = 100


async def list_own_reviews(session: AsyncSession, *, vendor_user_id: str) -> VendorOwnerReviewsResponse:
    """The vendor's visible reviews (hidden ones excluded, same as their public profile)."""
    reviews = await repository.visible_reviews_for_vendor(
        session, vendor_user_id, limit=_VENDOR_REVIEWS_LIMIT
    )
    stats = await repository.visible_review_stats_for_vendor(session, vendor_user_id)
    event_context = await repository.event_context_by_booking_id(
        session, [review.booking_request_id for review in reviews]
    )
    reviewer_emails = await identity_service.emails_by_id(
        session, [review.client_user_id for review in reviews]
    )
    items = []
    for review in reviews:
        booking_context = event_context.get(review.booking_request_id)
        items.append(
            VendorOwnerReviewItem(
                id=review.id,
                rating=review.rating,
                body=review.body,
                created_at=review.created_at,
                reviewer_display=reviewer_display_from_email(reviewer_emails.get(review.client_user_id)),
                event_name=booking_context.event_name if booking_context else "Event",
                event_date=booking_context.event_date if booking_context else "",
                booking_total_label=booking_context.total_label if booking_context else "",
                image_urls=review.image_urls,
                booking_request_id=review.booking_request_id,
            )
        )
    return VendorOwnerReviewsResponse(
        average_rating=stats.average_rating, review_count=stats.review_count, reviews=items
    )
