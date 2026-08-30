"""Parse booking ids from HTTP path params."""

from __future__ import annotations

import uuid

from fastapi import HTTPException

from app.features.bookings import messages as booking_messages


def parse_booking_id(booking_id: str) -> str:
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e
    return booking_id
