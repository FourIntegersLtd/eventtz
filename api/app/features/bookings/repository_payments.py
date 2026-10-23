"""Database reads the booking money flows need beyond one booking: the payout ledger and payout history.

Writes to `payment_status` go through `repository.update_booking` with a
`payment_status_in` condition, so two racing requests cannot both move the money.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ColumnElement, and_, case, desc, exists, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.core.pagination import paged
from app.features.bookings.domain_payments import PAID_PAYMENT_STATUSES, PAYOUT_RELEASED
from app.features.bookings.models import BookingRequest
from app.features.bookings.repository import BOOKING_COLUMNS
from app.features.bookings.rows import BookingRow


def _ledger_filter(vendor_uuid: uuid.UUID) -> ColumnElement[bool]:
    """The vendor's bookings whose payment was collected (`paid`), paid out, or split by a client cancel."""
    return and_(
        BookingRequest.vendor_user_id == vendor_uuid,
        or_(
            BookingRequest.payment_status.in_(PAID_PAYMENT_STATUSES),
            # A client cancel the vendor's policy left them a share of (domain_cancellation).
            BookingRequest.cancellation_vendor_share_gbp > 0,
        ),
    )


# A ledger row is a cancellation share when a partial refund left the vendor a recorded share.
_IS_SHARE = func.coalesce(BookingRequest.cancellation_vendor_share_gbp, 0) > 0
_IS_RELEASED = case(
    (_IS_SHARE, BookingRequest.cancellation_payout_at.is_not(None)),
    else_=BookingRequest.payment_status == PAYOUT_RELEASED,
)
_PAID_OUT_AT = case(
    (_IS_SHARE, BookingRequest.cancellation_payout_at), else_=BookingRequest.payout_released_at
)
# NULL for an old booking with no payment-time snapshot; the service prices those from the line items.
_SNAPSHOT_AMOUNT = case(
    (_IS_SHARE, func.round(BookingRequest.cancellation_vendor_share_gbp, 2)),
    else_=func.round(BookingRequest.vendor_amount_gbp, 2),
)
# Newest first: when the payout went out, else when the client paid, else when the booking was made.
_NEWEST_FIRST_KEY = func.coalesce(
    BookingRequest.payout_released_at,
    BookingRequest.cancellation_payout_at,
    BookingRequest.paid_at,
    BookingRequest.created_at,
)


async def payout_ledger_page(
    session: AsyncSession, vendor_user_id: str, *, offset: int, limit: int
) -> tuple[list[BookingRow], int]:
    """One page of the vendor's payout ledger, newest first, and how many ledger rows there are."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return [], 0
    found_rows, total = await paged(
        session,
        select(*BOOKING_COLUMNS).where(_ledger_filter(vendor_uuid)),
        order_by=[_NEWEST_FIRST_KEY.desc()],
        tie_breaker=BookingRequest.id.desc(),
        offset=offset,
        limit=limit,
        count_query=select(func.count()).select_from(BookingRequest).where(_ledger_filter(vendor_uuid)),
    )
    return [BookingRow.model_validate(plain_row(found)) for found in found_rows], total


@dataclass(frozen=True)
class PayoutLedgerSums:
    """Totals over the vendor's whole ledger, from rows that carry a payment-time snapshot.

    Old bookings without one come back in `unsnapshotted` for the service to price.
    """

    paid_out: Decimal
    paid_out_since: Decimal
    awaiting: Decimal
    awaiting_count: int
    unsnapshotted: list[BookingRow]


async def payout_ledger_sums(
    session: AsyncSession, vendor_user_id: str, *, since: datetime
) -> PayoutLedgerSums:
    """Paid-out, recently paid-out (on or after `since`) and awaiting totals, summed in the database."""
    vendor_uuid = as_uuid(vendor_user_id)
    if vendor_uuid is None:
        return PayoutLedgerSums(Decimal(0), Decimal(0), Decimal(0), 0, [])
    ledger = _ledger_filter(vendor_uuid)
    paid_out, paid_out_since, awaiting, awaiting_count = (
        await session.execute(
            select(
                func.coalesce(func.sum(_SNAPSHOT_AMOUNT).filter(_IS_RELEASED), 0),
                func.coalesce(func.sum(_SNAPSHOT_AMOUNT).filter(_IS_RELEASED, since <= _PAID_OUT_AT), 0),
                func.coalesce(func.sum(_SNAPSHOT_AMOUNT).filter(not_(_IS_RELEASED)), 0),
                func.count().filter(
                    not_(_IS_RELEASED), or_(_IS_SHARE, BookingRequest.vendor_amount_gbp.is_not(None))
                ),
            ).where(ledger)
        )
    ).one()
    legacy = await session.execute(
        select(*BOOKING_COLUMNS).where(ledger, not_(_IS_SHARE), BookingRequest.vendor_amount_gbp.is_(None))
    )
    return PayoutLedgerSums(
        paid_out=Decimal(paid_out),
        paid_out_since=Decimal(paid_out_since),
        awaiting=Decimal(awaiting),
        awaiting_count=int(awaiting_count),
        unsnapshotted=[BookingRow.model_validate(plain_row(found)) for found in legacy],
    )


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
    """The vendor's most recently paid Transfer id; used by payments to restore a lost Connect account."""
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
