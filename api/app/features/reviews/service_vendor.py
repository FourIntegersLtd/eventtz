"""Use case for a signed-in vendor: their own reviews list, matching their public profile."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

# Matches the baseline's `list_reviews_for_vendor_owner` cap.
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.features.identity import service as identity_service
from app.features.reviews import repository
from app.features.reviews.domain import reviewer_display_from_email
from app.features.reviews.schemas import VendorOwnerReviewItem, VendorOwnerReviewsResponse

_VENDOR_REVIEWS_LIMIT = 100


async def list_own_reviews(
    session: AsyncSession,
    *,
    vendor_user_id: str,
    min_rating: int | None = None,
    offset: int = 0,
    limit: int = DEFAULT_LIST_LIMIT,
) -> VendorOwnerReviewsResponse:
    """The vendor's visible reviews (hidden ones excluded, same as their public profile)."""
    page_limit = min(max(limit, 1), _VENDOR_REVIEWS_LIMIT)
    reviews, total = await repository.visible_reviews_for_vendor_page(
        session,
        vendor_user_id,
        min_rating=min_rating,
        offset=offset,
        limit=page_limit,
    )
    stats = await repository.visible_review_stats_for_vendor(session, vendor_user_id)
    five_star_count = await repository.visible_five_star_count_for_vendor(session, vendor_user_id)
    with_photos_count = await repository.visible_photo_review_count_for_vendor(session, vendor_user_id)
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
        average_rating=stats.average_rating,
        review_count=stats.review_count,
        five_star_count=five_star_count,
        with_photos_count=with_photos_count,
        reviews=items,
        total=total,
        offset=offset,
        limit=page_limit,
    )
