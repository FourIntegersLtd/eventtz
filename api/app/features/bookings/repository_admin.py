"""Database access for the admin bookings console: list/detail across every party,
payment-field and support-hold writes, and the batched lookups the needs-attention
diagnostics use.

A second `repository*.py` file, not a duplicate of `repository.py`: the admin
screens read across every client and vendor (no party filter), with a different
set of filters (date range, free-text search) and their own writes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, Text, Uuid, column, exists, func, select, table, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.bookings.domain_financials import PAID_PAYMENT_STATUSES
from app.features.bookings.models import BookingRequest
from app.features.bookings.rows import BookingRow


def _as_datetime_bound(value: str) -> datetime:
    """An admin's `date_from`/`date_to` query string, as a timestamp Postgres can compare.

    The admin console sends plain dates (`2030-01-01`) or full ISO timestamps; a
    `timestamptz` column has no `>=`/`<=` operator against a bare string, so this
    parses it before it reaches a query. A date-only string means midnight UTC, and so
    does a timestamp without an offset: Postgres read those in the database's UTC
    session zone on the baseline, not in this server's local zone.
    """
    bound = datetime.fromisoformat(value if len(value) > 10 else f"{value}T00:00:00+00:00")
    return bound.replace(tzinfo=UTC) if bound.tzinfo is None else bound.astimezone(UTC)


# Every column the admin list, detail and financials views read.
_BOOKING_COLUMNS = (
    BookingRequest.id,
    BookingRequest.client_user_id,
    BookingRequest.vendor_user_id,
    BookingRequest.status,
    BookingRequest.payment_status,
    BookingRequest.initiator,
    BookingRequest.event_name,
    BookingRequest.event_date,
    BookingRequest.event_end_date,
    BookingRequest.event_postcode,
    BookingRequest.event_address,
    BookingRequest.notes,
    BookingRequest.total_label,
    BookingRequest.initial_client_total_label,
    BookingRequest.selected_option_ids,
    BookingRequest.line_items,
    BookingRequest.vendor_adjustments,
    BookingRequest.service_fee_percent,
    BookingRequest.vendor_referral_code,
    BookingRequest.conversation_id,
    BookingRequest.event_id,
    BookingRequest.created_at,
    BookingRequest.updated_at,
    BookingRequest.paid_at,
    BookingRequest.client_completion_confirmed_at,
    BookingRequest.vendor_completion_confirmed_at,
    BookingRequest.stripe_checkout_session_id,
    BookingRequest.stripe_payment_intent_id,
    BookingRequest.stripe_charge_id,
    BookingRequest.stripe_transfer_id,
    BookingRequest.stripe_receipt_url,
    BookingRequest.payment_amount_gbp,
    BookingRequest.vendor_amount_gbp,
    BookingRequest.platform_fee_gbp,
    BookingRequest.referral_fee_discount_gbp,
    BookingRequest.payout_released_at,
    BookingRequest.payout_auto_released_at,
    BookingRequest.completion_reminder_sent_at,
    BookingRequest.completed_at,
    BookingRequest.refunded_at,
    BookingRequest.cancelled_by,
    BookingRequest.support_hold,
)

# Disputes are their own slice; this handle reads its table inside the admin booking query (same
# handle `bookings/repository.py` keeps privately, for the same active-dispute check).
_dispute_cases = table("dispute_cases", column("booking_request_id", Uuid), column("status", Text))
_ACTIVE_DISPUTE_STATUSES = ("open", "under_review")

# Vendors' Stripe payout wiring, read in one batch for a whole page of bookings.
_vendors = table(
    "vendors",
    column("user_id", Uuid),
    column("stripe_account_id", Text),
    column("stripe_payouts_enabled", Boolean),
)


def _list_conditions(
    *, status: str | None, date_from: str | None, date_to: str | None, search: str | None
) -> list[Any]:
    """WHERE clauses for the admin list: exact status, a created_at range, and event-name search."""
    conditions: list[Any] = []
    if status and status != "all":
        conditions.append(BookingRequest.status == status)
    if date_from:
        conditions.append(BookingRequest.created_at >= _as_datetime_bound(date_from))
    if date_to:
        conditions.append(BookingRequest.created_at <= _as_datetime_bound(date_to))
    if search:
        conditions.append(BookingRequest.event_name.ilike(f"%{search}%"))
    return conditions


async def list_admin_bookings(
    session: AsyncSession,
    *,
    offset: int,
    limit: int,
    status: str | None,
    date_from: str | None,
    date_to: str | None,
    search: str | None,
) -> tuple[list[BookingRow], int]:
    """A page of bookings across every party, newest first, with the total matching count."""
    conditions = _list_conditions(status=status, date_from=date_from, date_to=date_to, search=search)
    count_result = await session.execute(select(func.count()).select_from(BookingRequest).where(*conditions))
    total = int(count_result.scalar_one())
    result = await session.execute(
        select(*_BOOKING_COLUMNS)
        .where(*conditions)
        .order_by(BookingRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result], total


async def get_admin_booking(session: AsyncSession, booking_id: str) -> BookingRow | None:
    """One booking by id, whoever its parties are (the admin console is not scoped to one)."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return None
    result = await session.execute(select(*_BOOKING_COLUMNS).where(BookingRequest.id == booking_uuid))
    found = result.first()
    return BookingRow.model_validate(plain_row(found)) if found is not None else None


async def update_payment_fields(session: AsyncSession, booking_id: str, values: dict[str, Any]) -> bool:
    """Write the verified Stripe ids and amount onto the booking. Returns whether a row changed."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return False
    result = await session.execute(
        update(BookingRequest)
        .where(BookingRequest.id == booking_uuid)
        .values(**values)
        .returning(BookingRequest.id)
    )
    return result.first() is not None


async def clear_checkout_session(session: AsyncSession, booking_id: str) -> bool:
    """Clear a stale checkout session and return the booking to unpaid, only while it still can be."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return False
    result = await session.execute(
        update(BookingRequest)
        .where(
            BookingRequest.id == booking_uuid,
            BookingRequest.payment_status.in_(("pending", "unpaid")),
        )
        .values(stripe_checkout_session_id=None, payment_status="unpaid")
        .returning(BookingRequest.id)
    )
    return result.first() is not None


async def set_support_hold(session: AsyncSession, booking_id: str, *, hold: bool) -> bool:
    """Pause or resume automatic payout release. Returns whether a row changed."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return False
    result = await session.execute(
        update(BookingRequest)
        .where(BookingRequest.id == booking_uuid)
        .values(support_hold=hold)
        .returning(BookingRequest.id)
    )
    return result.first() is not None


async def vendor_payouts_enabled_by_user_id(
    session: AsyncSession, vendor_user_ids: list[str]
) -> dict[str, bool]:
    """Whether Stripe can pay each vendor (a connected account with payouts switched on)."""
    vendor_uuids = [parsed for parsed in (as_uuid(vendor_id) for vendor_id in vendor_user_ids) if parsed]
    if not vendor_uuids:
        return {}
    result = await session.execute(
        select(_vendors.c.user_id, _vendors.c.stripe_account_id, _vendors.c.stripe_payouts_enabled).where(
            _vendors.c.user_id.in_(vendor_uuids)
        )
    )
    return {
        str(vendor_id): bool(account_id and payouts_enabled)
        for vendor_id, account_id, payouts_enabled in result
    }


async def booking_ids_with_active_disputes(session: AsyncSession, booking_ids: list[str]) -> set[str]:
    """Which of these bookings have a dispute that is open or under review."""
    booking_uuids = [parsed for parsed in (as_uuid(booking_id) for booking_id in booking_ids) if parsed]
    if not booking_uuids:
        return set()
    result = await session.execute(
        select(_dispute_cases.c.booking_request_id).where(
            _dispute_cases.c.booking_request_id.in_(booking_uuids),
            _dispute_cases.c.status.in_(_ACTIVE_DISPUTE_STATUSES),
        )
    )
    return {str(booking_id) for booking_id in result.scalars()}


async def has_active_dispute(session: AsyncSession, booking_id: str) -> bool:
    """True when this one booking has a dispute that is open or under review."""
    result = await session.execute(
        select(
            exists().where(
                _dispute_cases.c.booking_request_id == as_uuid(booking_id),
                _dispute_cases.c.status.in_(_ACTIVE_DISPUTE_STATUSES),
            )
        )
    )
    return bool(result.scalar())


async def paid_bookings_for_financials(
    session: AsyncSession, *, date_from: str | None, date_to: str | None
) -> list[BookingRow]:
    """Every paid booking (`domain_financials.PAID_PAYMENT_STATUSES`) whose `paid_at` falls in range.

    Capped at 5000 rows, oldest first, matching the baseline's own cap.
    """
    conditions: list[Any] = [BookingRequest.payment_status.in_(PAID_PAYMENT_STATUSES)]
    if date_from:
        conditions.append(BookingRequest.paid_at >= _as_datetime_bound(date_from))
    if date_to:
        conditions.append(BookingRequest.paid_at <= _as_datetime_bound(date_to))
    result = await session.execute(
        select(*_BOOKING_COLUMNS).where(*conditions).order_by(BookingRequest.paid_at.asc()).limit(5000)
    )
    return [BookingRow.model_validate(plain_row(found)) for found in result]
