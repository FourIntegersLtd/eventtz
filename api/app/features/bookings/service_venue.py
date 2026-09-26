"""The client sets the venue of an accepted booking before paying for it."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository, service_queries
from app.features.bookings.errors import BookingAlreadyPaid, BookingNotFound, VenueAcceptedOnly
from app.features.bookings.schemas import ClientBookingDetail, UpdateBookingVenueBody
from app.features.bookings.service_common import announce_change


async def update_venue(
    session: AsyncSession, client_user_id: str, booking_id: str, body: UpdateBookingVenueBody
) -> ClientBookingDetail:
    """Store the venue address (and postcode, when given) while the booking is accepted and unpaid."""
    booking = await repository.get_booking(session, booking_id, client_user_id=client_user_id)
    if booking is None:
        raise BookingNotFound()
    if booking.status != "accepted":
        raise VenueAcceptedOnly()
    if (booking.payment_status or "unpaid") not in ("unpaid", "pending"):
        raise BookingAlreadyPaid()
    values = {"event_address": body.event_address}
    if body.event_postcode:
        values["event_postcode"] = body.event_postcode
    await repository.update_booking(session, booking.id, values, client_user_id=client_user_id)
    announce_change(session, booking)
    return await service_queries.client_booking_detail(session, client_user_id, booking.id)
