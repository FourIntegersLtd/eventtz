"""Who is on a booking, for other slices that only need to check a booking reference."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository
from app.features.bookings.rows import BookingRow


async def get_booking_parties(session: AsyncSession, booking_id: str) -> BookingRow | None:
    """The booking (with its client and vendor ids), or `None` when the id is unknown or not a UUID."""
    return await repository.get_booking(session, booking_id)
