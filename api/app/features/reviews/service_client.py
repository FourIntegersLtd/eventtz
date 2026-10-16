"""Use cases for a signed-in client: submit a review, list their own reviews."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.marketplace import service_events as events
from app.features.reviews import repository
from app.features.reviews.errors import (
    ReviewAlreadySubmitted,
    ReviewBookingNotFound,
    ReviewOnlyAfterComplete,
    ReviewTooShort,
)
from app.features.reviews.schemas import (
    ClientOwnerReviewItem,
    ClientOwnerReviewsResponse,
    PostBookingReviewBody,
    PostBookingReviewResponse,
    SubmittedReview,
)
from app.features.vendors import service_listing as vendors_service

# The client's own reviews list is capped like the baseline's `list_reviews_for_client`.
_CLIENT_REVIEWS_LIMIT = 100


async def submit_review(
    session: AsyncSession, *, client_user_id: str, booking_id: str, body: PostBookingReviewBody
) -> PostBookingReviewResponse:
    """Record a client's review of one of their own completed bookings.

    BASELINE QUIRK: a booking that does not exist, or belongs to someone else,
    is a 400 "Booking not found." (not a 404) - `create_booking_review` raised
    a plain `ValueError` the route always mapped to 400.
    """
    booking = await repository.booking_for_review(session, booking_id)
    if booking is None or booking.client_user_id != client_user_id:
        raise ReviewBookingNotFound
    if booking.status != "completed":
        raise ReviewOnlyAfterComplete
    if await repository.review_exists_for_booking(session, booking_id):
        raise ReviewAlreadySubmitted

    # Pydantic's min_length=10 counts raw characters, so whitespace-only bodies pass it;
    # this check runs on the stripped text, matching the baseline's own re-check.
    stripped_body = body.body.strip()
    if len(stripped_body) < 10:
        raise ReviewTooShort

    saved = await repository.insert_review(
        session,
        {
            "booking_request_id": booking_id,
            "vendor_user_id": booking.vendor_user_id,
            "client_user_id": client_user_id,
            "rating": body.rating,
            "body": stripped_body,
            "image_urls": body.image_urls,
        },
    )
    await events.record_marketplace_event(
        session,
        "review_submitted",
        actor_user_id=client_user_id,
        vendor_user_id=booking.vendor_user_id,
        booking_request_id=booking_id,
        payload={"rating": body.rating, "photo_count": len(body.image_urls)},
    )
    return PostBookingReviewResponse(
        review=SubmittedReview(
            id=saved.id,
            rating=saved.rating,
            body=saved.body,
            created_at=saved.created_at,
            image_urls=saved.image_urls,
        )
    )


async def list_own_reviews(session: AsyncSession, *, client_user_id: str) -> ClientOwnerReviewsResponse:
    """Every review this client has submitted, with the vendor's display name and event context."""
    reviews = await repository.reviews_for_client(session, client_user_id, limit=_CLIENT_REVIEWS_LIMIT)
    event_context = await repository.event_context_by_booking_id(
        session, [review.booking_request_id for review in reviews]
    )
    vendor_display_names = await vendors_service.display_names(
        session, [review.vendor_user_id for review in reviews]
    )
    items = []
    for review in reviews:
        booking_context = event_context.get(review.booking_request_id)
        items.append(
            ClientOwnerReviewItem(
                id=review.id,
                rating=review.rating,
                body=review.body,
                created_at=review.created_at,
                booking_request_id=review.booking_request_id,
                vendor_user_id=review.vendor_user_id,
                vendor_display_name=vendor_display_names.get(review.vendor_user_id, "Vendor"),
                event_name=booking_context.event_name if booking_context else "Event",
                event_date=booking_context.event_date if booking_context else "",
                image_urls=review.image_urls,
            )
        )
    return ClientOwnerReviewsResponse(review_count=len(items), reviews=items)
