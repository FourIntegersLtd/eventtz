"""Database reads for payment receipts, vendor payment records and payout statements.

Adds the three write-once snapshot columns to the ordinary booking read. Writing a
snapshot goes through `repository.update_booking(..., unset_column=...)` directly
(no new write helper needed): the condition already gives write-once semantics.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.bookings.models import BookingRequest
from app.features.bookings.repository import BOOKING_COLUMNS
from app.features.bookings.rows import ReceiptBookingRow

RECEIPT_COLUMNS = (
    *BOOKING_COLUMNS,
    BookingRequest.payment_receipt_snapshot,
    BookingRequest.vendor_payment_record_snapshot,
    BookingRequest.vendor_payout_statement_snapshot,
)


async def get_booking_for_receipt(
    session: AsyncSession,
    booking_id: str,
    *,
    client_user_id: str | None = None,
    vendor_user_id: str | None = None,
) -> ReceiptBookingRow | None:
    """The booking plus its frozen receipt snapshots, if it exists and belongs to the caller."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return None
    conditions: list[Any] = [BookingRequest.id == booking_uuid]
    if client_user_id is not None:
        conditions.append(BookingRequest.client_user_id == as_uuid(client_user_id))
    if vendor_user_id is not None:
        conditions.append(BookingRequest.vendor_user_id == as_uuid(vendor_user_id))
    result = await session.execute(select(*RECEIPT_COLUMNS).where(*conditions))
    found = result.first()
    return ReceiptBookingRow.model_validate(plain_row(found)) if found is not None else None
