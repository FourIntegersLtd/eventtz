"""A client turning down a vendor's new price keeps the booking open and tells the vendor."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import service_queries, service_status
from tests.http.test_bookings_maintenance import _make_booking, _make_parties, _notices, _stored
from tests.support.fakes import FakeMailer

pytestmark = [pytest.mark.db]


async def test_declining_a_new_price_tells_the_vendor_and_keeps_the_original(
    db_session: AsyncSession,
) -> None:
    """The booking returns to the original price, and the vendor's booking says the client declined."""
    client_id, vendor_id = await _make_parties(db_session, "price-declined")
    booking = await _make_booking(
        db_session,
        client_id=client_id,
        vendor_id=vendor_id,
        status="pending",
        payment_status="unpaid",
        initiator="client",
        line_items=[{"id": "pkg", "heading": "Photography", "unit_price_gbp": 18, "quantity": 1}],
        vendor_adjustments=[{"id": "adj-1", "tag": "other", "label": "for delivery", "amount_gbp": 10}],
        payment_amount_gbp=None,
        vendor_amount_gbp=None,
        stripe_payment_intent_id=None,
        stripe_charge_id=None,
    )
    mailer = FakeMailer()

    result = await service_status.answer_for_client(
        db_session,
        mailer,
        client_id,
        booking.id,
        "declined",
        event_postcode=None,
        event_address=None,
    )

    stored = await _stored(db_session, booking.id)
    detail = await service_queries.vendor_booking_detail(db_session, vendor_id, booking.id)
    assert result.booking_status == "pending"
    assert stored.status == "pending"
    assert stored.vendor_adjustments == []
    assert await _notices(db_session, vendor_id) == [
        (
            "client_declined_updated_price",
            "The client declined the updated price.\n\n"
            "The booking is still open at the original price. You can message them "
            "or send a new price if needed.",
        )
    ]
    assert detail.price_update_declined is True
    assert mailer.sent
