"""Submitting a review records one `review_submitted` funnel event, as the baseline does."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository
from app.features.reviews import service_client
from app.features.reviews.schemas import PostBookingReviewBody

pytestmark = [pytest.mark.db]


async def _account(session: AsyncSession, user_type: str) -> str:
    """A verified test account of `user_type`; returns its id."""
    account_id = await identity_repository.create_account(
        session,
        email=f"review-event-{user_type}@example.com",
        user_type=user_type,
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    return account_id


async def test_submitting_a_review_stores_one_review_submitted_event(db_session: AsyncSession) -> None:
    """The event carries the client as actor, the vendor, the booking, the rating and the photo count."""
    client_id = await _account(db_session, "client")
    vendor_id = await _account(db_session, "vendor")
    booking = await bookings_repository.insert_booking(
        db_session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Review party",
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
        body=PostBookingReviewBody(
            rating=4, body="Lovely food and great service.", image_urls=["https://example.com/a.jpg"]
        ),
    )

    rows = (
        await db_session.execute(
            text(
                "select actor_user_id::text, vendor_user_id::text, booking_request_id::text, payload "
                "from marketplace_events where event_name = 'review_submitted'"
            )
        )
    ).all()
    assert [tuple(row) for row in rows] == [
        (client_id, vendor_id, booking.id, {"rating": 4, "photo_count": 1})
    ]
