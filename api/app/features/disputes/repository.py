"""Database access for disputes. The only file in `disputes` that queries.

`booking_requests`, `conversations` and `users` belong to other slices; this
module reads them through lightweight `table()` handles rather than importing
their models or repositories - the same sanctioned pattern `bookings/repository.py`
uses to read `booking_reviews` and `dispute_cases`. Nothing here writes to those
other tables.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Boolean, Date, Numeric, Text, Uuid, column, exists, insert, select, table, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.disputes.domain import ACTIVE_STATUSES
from app.features.disputes.models import DisputeCase
from app.features.disputes.rows import DisputeBookingRow, DisputeRow, UserRoleRow

_DISPUTE_COLUMNS = (
    DisputeCase.id,
    DisputeCase.booking_request_id,
    DisputeCase.opened_by_user_id,
    DisputeCase.status,
    DisputeCase.summary,
    DisputeCase.internal_notes,
    DisputeCase.resolution_note,
    DisputeCase.client_resolution_note,
    DisputeCase.vendor_resolution_note,
    DisputeCase.assigned_admin_id,
    DisputeCase.conversation_id,
    DisputeCase.resolution_action,
    DisputeCase.refund_amount_gbp,
    DisputeCase.created_at,
    DisputeCase.updated_at,
    DisputeCase.resolved_at,
)

# Read-only handles onto tables `disputes` does not own.
_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("client_user_id", Uuid),
    column("vendor_user_id", Uuid),
    column("status", Text),
    column("payment_status", Text),
    column("conversation_id", Uuid),
    column("event_name", Text),
    column("event_date", Date),
    column("payment_amount_gbp", Numeric(12, 2)),
)
_conversations = table(
    "conversations", column("id", Uuid), column("client_user_id", Uuid), column("vendor_user_id", Uuid)
)
_users = table("users", column("id", Uuid), column("user_type", Text), column("account_suspended", Boolean))


def _dispute_row(found: Any) -> DisputeRow:
    """One `dispute_cases` result row as a `DisputeRow`."""
    return DisputeRow.model_validate(plain_row(found))


# --- disputes ------------------------------------------------------------------------------------


async def get_dispute(session: AsyncSession, dispute_id: str) -> DisputeRow | None:
    """The dispute, or `None` if the id is malformed or names no row."""
    dispute_uuid = as_uuid(dispute_id)
    if dispute_uuid is None:
        return None
    result = await session.execute(select(*_DISPUTE_COLUMNS).where(DisputeCase.id == dispute_uuid))
    found = result.first()
    return _dispute_row(found) if found is not None else None


async def list_disputes_on_booking(session: AsyncSession, booking_id: str) -> list[DisputeRow]:
    """Every dispute raised on this booking, most recently created first."""
    result = await session.execute(
        select(*_DISPUTE_COLUMNS)
        .where(DisputeCase.booking_request_id == as_uuid(booking_id))
        .order_by(DisputeCase.created_at.desc())
    )
    return [_dispute_row(found) for found in result]


async def list_disputes_for_party(session: AsyncSession, user_id: str) -> list[DisputeRow]:
    """Every dispute on a booking this user is the client or vendor of, most recent first."""
    user_uuid = as_uuid(user_id)
    joined = DisputeCase.__table__.join(
        _booking_requests, _booking_requests.c.id == DisputeCase.booking_request_id
    )
    is_party = (_booking_requests.c.client_user_id == user_uuid) | (
        _booking_requests.c.vendor_user_id == user_uuid
    )
    result = await session.execute(
        select(*_DISPUTE_COLUMNS)
        .select_from(joined)
        .where(is_party)
        .order_by(DisputeCase.created_at.desc())
        .limit(200)
    )
    return [_dispute_row(found) for found in result]


async def list_disputes_for_admin(
    session: AsyncSession, *, statuses: tuple[str, ...] | None
) -> list[DisputeRow]:
    """Every dispute in the given statuses (or every dispute, when `statuses` is `None`)."""
    query = select(*_DISPUTE_COLUMNS)
    if statuses is not None:
        query = query.where(DisputeCase.status.in_(statuses))
    result = await session.execute(query.order_by(DisputeCase.created_at.desc()).limit(500))
    return [_dispute_row(found) for found in result]


async def has_active_dispute(session: AsyncSession, booking_id: str) -> bool:
    """Whether the booking already has an open or under_review dispute."""
    result = await session.execute(
        select(
            exists().where(
                DisputeCase.booking_request_id == as_uuid(booking_id), DisputeCase.status.in_(ACTIVE_STATUSES)
            )
        )
    )
    return bool(result.scalar())


async def insert_dispute(
    session: AsyncSession,
    *,
    booking_request_id: str,
    opened_by_user_id: str,
    summary: str,
    conversation_id: str | None,
) -> DisputeRow:
    """Store a new dispute (status defaults to "open" in the database) and return it."""
    async with session.begin_nested():
        result = await session.execute(
            insert(DisputeCase)
            .values(
                booking_request_id=as_uuid(booking_request_id),
                opened_by_user_id=as_uuid(opened_by_user_id),
                summary=summary,
                conversation_id=as_uuid(conversation_id),
            )
            .returning(*_DISPUTE_COLUMNS)
        )
        created = result.one()
    return _dispute_row(created)


async def update_dispute(session: AsyncSession, dispute_id: str, values: dict[str, Any]) -> DisputeRow | None:
    """Write `values` on the dispute; `None` if the id names no row."""
    result = await session.execute(
        update(DisputeCase)
        .where(DisputeCase.id == as_uuid(dispute_id))
        .values(**values)
        .returning(*_DISPUTE_COLUMNS)
    )
    found = result.first()
    return _dispute_row(found) if found is not None else None


# --- other slices' tables, read-only --------------------------------------------------------------


async def get_booking(session: AsyncSession, booking_id: str) -> DisputeBookingRow | None:
    """The booking's party ids, status and money state; `None` if the id is malformed or missing."""
    booking_uuid = as_uuid(booking_id)
    if booking_uuid is None:
        return None
    result = await session.execute(select(_booking_requests).where(_booking_requests.c.id == booking_uuid))
    found = result.first()
    return DisputeBookingRow.model_validate(plain_row(found)) if found is not None else None


async def lookup_pair_conversation_id(
    session: AsyncSession, *, client_user_id: str, vendor_user_id: str
) -> str | None:
    """Any existing DM thread between this client and this vendor, without creating one."""
    result = await session.execute(
        select(_conversations.c.id).where(
            _conversations.c.client_user_id == as_uuid(client_user_id),
            _conversations.c.vendor_user_id == as_uuid(vendor_user_id),
        )
    )
    found = result.first()
    return str(found[0]) if found is not None and found[0] is not None else None


async def get_user_role(session: AsyncSession, user_id: str) -> UserRoleRow | None:
    """The account's type and suspension state, for the admin-assignee check; `None` if missing."""
    user_uuid = as_uuid(user_id)
    if user_uuid is None:
        return None
    result = await session.execute(
        select(_users.c.id, _users.c.user_type, _users.c.account_suspended).where(_users.c.id == user_uuid)
    )
    found = result.first()
    return UserRoleRow.model_validate(plain_row(found)) if found is not None else None
