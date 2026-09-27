"""Database reads the booking money flows need beyond one booking: the payout ledger and payout history.

Writes to `payment_status` go through `repository.update_booking` with a
`payment_status_in` condition, so two racing requests cannot both move the money.
"""

from __future__ import annotations

from sqlalchemy import desc, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.bookings.domain_payments import PAID_PAYMENT_STATUSES
from app.features.bookings.models import BookingRequest
from app.features.bookings.repository import BOOKING_COLUMNS
from app.features.bookings.rows import BookingRow


async def payout_ledger_bookings(session: AsyncSession, vendor_user_id: str) -> list[BookingRow]:
    """The vendor's bookings whose payment was collected (`paid`) or already paid out."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return []
    result = await session.execute(
        select(*BOOKING_COLUMNS).where(
            BookingRequest.vendor_user_id == vendor_uuid,
            BookingRequest.payment_status.in_(PAID_PAYMENT_STATUSES),
        )
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]


async def vendor_has_transfer(session: AsyncSession, vendor_user_id: str) -> bool:
    """True when at least one of the vendor's bookings records a Stripe Transfer."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return False
    found = await session.scalar(
        select(
            exists().where(
                BookingRequest.vendor_user_id == vendor_uuid,
                BookingRequest.stripe_transfer_id.is_not(None),
            )
        )
    )
    return bool(found)


async def latest_transfer_id_for_vendor(session: AsyncSession, vendor_user_id: str) -> str | None:
    """The vendor's most recently paid Transfer id, for restoring an orphaned Connect account."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return None
    found = await session.scalar(
        select(BookingRequest.stripe_transfer_id)
        .where(
            BookingRequest.vendor_user_id == vendor_uuid,
            BookingRequest.stripe_transfer_id.is_not(None),
        )
        .order_by(desc(BookingRequest.paid_at))
        .limit(1)
    )
    return str(found).strip() or None if found else None
