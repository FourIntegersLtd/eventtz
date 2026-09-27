"""Database reads and write-once updates for payment receipt snapshots."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionTransaction

from app.core.db import as_uuid, plain_row
from app.features.bookings import repository
from app.features.bookings.models import BookingRequest
from app.features.bookings.repository import BOOKING_COLUMNS
from app.features.bookings.rows import ReceiptBookingRow


def receipt_freeze_savepoint(session: AsyncSession) -> AsyncSessionTransaction:
    """A savepoint around receipt snapshot writes and their emails.

    Freeze runs in the same transaction as marking a booking paid or releasing a
    payout. A database error there would abort the whole transaction and undo the
    money write unless it is confined to this savepoint.
    """
    return session.begin_nested()


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


async def freeze_receipt_snapshots(
    session: AsyncSession,
    booking_id: str,
    *,
    client_snapshot: dict[str, Any] | None,
    vendor_record_snapshot: dict[str, Any] | None,
) -> tuple[bool, bool]:
    """Persist checkout receipt payloads once; returns whether each column was newly written."""
    wrote_client = False
    wrote_vendor = False
    if client_snapshot is not None:
        wrote_client = await repository.update_booking(
            session,
            booking_id,
            {"payment_receipt_snapshot": client_snapshot},
            unset_column="payment_receipt_snapshot",
        )
    if vendor_record_snapshot is not None:
        wrote_vendor = await repository.update_booking(
            session,
            booking_id,
            {"vendor_payment_record_snapshot": vendor_record_snapshot},
            unset_column="vendor_payment_record_snapshot",
        )
    return wrote_client, wrote_vendor


async def freeze_payout_statement_snapshot(
    session: AsyncSession, booking_id: str, *, statement_snapshot: dict[str, Any]
) -> bool:
    """Persist the vendor payout statement once; True when the column was newly written."""
    return await repository.update_booking(
        session,
        booking_id,
        {"vendor_payout_statement_snapshot": statement_snapshot},
        unset_column="vendor_payout_statement_snapshot",
    )
