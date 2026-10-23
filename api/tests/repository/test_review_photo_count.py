"""The vendor reviews summary counts the vendor's visible reviews with photos across every page."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository
from app.features.reviews import repository, service_client, service_vendor
from app.features.reviews.schemas import PostBookingReviewBody

pytestmark = [pytest.mark.db]


async def _account(session: AsyncSession, email: str, user_type: str) -> str:
    """A verified test account; returns its id."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    return account_id


async def test_with_photos_count_covers_all_pages_not_just_the_returned_one(db_session: AsyncSession) -> None:
    """Three reviews (two with photos) and a page size of 1: the count is still exactly 2."""
    client_id = await _account(db_session, "photo-count-client@example.com", "client")
    vendor_id = await _account(db_session, "photo-count-vendor@example.com", "vendor")
    for position, image_urls in enumerate(
        [["https://example.com/a.jpg"], [], ["https://example.com/b.jpg", "https://example.com/c.jpg"]]
    ):
        booking = await bookings_repository.insert_booking(
            db_session,
            {
                "client_user_id": client_id,
                "vendor_user_id": vendor_id,
                "event_name": f"Photo party {position}",
                "event_date": "2020-06-01",
                "status": "completed",
                "payment_status": "paid",
                "initiator": "client",
                "total_label": "GBP 100.00",
                "selected_option_ids": [],
                "line_items": [],
                "vendor_adjustments": [],
            },
        )
        await service_client.submit_review(
            db_session,
            client_user_id=client_id,
            booking_id=booking.id,
            body=PostBookingReviewBody(rating=5, body="Lovely food and great service.", image_urls=image_urls),
        )

    assert await repository.visible_photo_review_count_for_vendor(db_session, vendor_id) == 2
    summary = await service_vendor.list_own_reviews(db_session, vendor_user_id=vendor_id, offset=0, limit=1)
    assert (len(summary.reviews), summary.total, summary.with_photos_count) == (1, 3, 2)
