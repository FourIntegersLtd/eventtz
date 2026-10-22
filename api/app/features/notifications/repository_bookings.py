"""The booking and dispute facts the feed shows, read through lightweight table handles.

`booking_requests` belongs to bookings and `dispute_cases` to disputes; neither is
rebuilt yet. These reads move behind those slices' services when they are.
Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import (
    DateTime,
    Select,
    Subquery,
    Text,
    Uuid,
    cast,
    column,
    func,
    literal,
    null,
    or_,
    select,
    table,
    union_all,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.notifications.domain_feed import TopicScope
from app.features.notifications.models import BookingNotification
from app.features.notifications.rows import BookingPartiesRow, FeedLineRow

_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("client_user_id", Uuid),
    column("vendor_user_id", Uuid),
    column("event_name", Text),
)
_dispute_cases = table(
    "dispute_cases",
    column("id", Uuid),
    column("booking_request_id", Uuid),
    column("status", Text),
    column("summary", Text),
    column("created_at", DateTime(timezone=True)),
    column("updated_at", DateTime(timezone=True)),
)


async def event_names(session: AsyncSession, booking_ids: list[str]) -> dict[str, str]:
    """Each booking's event name, trimmed; bookings with a blank name are absent."""
    parsed_ids = [parsed for parsed in (as_uuid(booking_id) for booking_id in booking_ids) if parsed]
    if not parsed_ids:
        return {}
    result = await session.execute(
        select(_booking_requests.c.id, _booking_requests.c.event_name).where(
            _booking_requests.c.id.in_(parsed_ids)
        )
    )
    names: dict[str, str] = {}
    for booking_id, event_name in result.tuples():
        trimmed = (event_name or "").strip()
        if trimmed:
            names[str(booking_id)] = trimmed
    return names


async def booking_parties(session: AsyncSession, booking_id: str) -> BookingPartiesRow | None:
    """The booking's client, vendor and event name, or None for an unknown id."""
    parsed_id = as_uuid(booking_id)
    if parsed_id is None:
        return None
    row = (
        await session.execute(
            select(
                _booking_requests.c.client_user_id,
                _booking_requests.c.vendor_user_id,
                _booking_requests.c.event_name,
            ).where(_booking_requests.c.id == parsed_id)
        )
    ).first()
    return BookingPartiesRow.model_validate(plain_row(row)) if row else None


def _notice_lines(user_id: UUID, scope: TopicScope, *, unread_only: bool) -> Select[Any]:
    """The user's stored notices as feed lines (shared columns of `_feed_union`)."""
    query = select(
        literal("notice").label("source"),
        BookingNotification.id.label("id"),
        BookingNotification.booking_id.label("booking_id"),
        BookingNotification.kind.label("kind"),
        BookingNotification.body.label("body"),
        BookingNotification.read_at.label("read_at"),
        cast(null(), Text).label("status"),
        cast(null(), Text).label("summary"),
        BookingNotification.created_at.label("created_at"),
        cast(null(), DateTime(timezone=True)).label("updated_at"),
        BookingNotification.created_at.label("sort_at"),
    ).where(BookingNotification.user_id == user_id)
    if unread_only:
        query = query.where(BookingNotification.read_at.is_(None))
    if scope.kinds_in is not None:
        query = query.where(BookingNotification.kind.in_(scope.kinds_in))
    return query


def _dispute_lines(user_id: UUID) -> Select[Any]:
    """Disputes on the user's bookings as feed lines, dated by last update (columns of `_feed_union`)."""
    return (
        select(
            literal("dispute").label("source"),
            _dispute_cases.c.id.label("id"),
            cast(null(), Uuid).label("booking_id"),
            cast(null(), Text).label("kind"),
            cast(null(), Text).label("body"),
            cast(null(), DateTime(timezone=True)).label("read_at"),
            _dispute_cases.c.status.label("status"),
            _dispute_cases.c.summary.label("summary"),
            _dispute_cases.c.created_at.label("created_at"),
            _dispute_cases.c.updated_at.label("updated_at"),
            func.coalesce(_dispute_cases.c.updated_at, _dispute_cases.c.created_at).label("sort_at"),
        )
        .join(_booking_requests, _booking_requests.c.id == _dispute_cases.c.booking_request_id)
        .where(
            or_(_booking_requests.c.client_user_id == user_id, _booking_requests.c.vendor_user_id == user_id)
        )
    )


def _feed_union(user_id: UUID, scope: TopicScope, *, unread_only: bool) -> Subquery:
    """Notices and disputes of the user that the topic and read state keep, as one set of lines.

    Disputes carry no read state, so an unread-only feed has none.
    """
    parts: list[Select[Any]] = []
    if scope.notices:
        parts.append(_notice_lines(user_id, scope, unread_only=unread_only))
    if scope.disputes and not unread_only:
        parts.append(_dispute_lines(user_id))
    return union_all(*parts).subquery("feed_lines")


async def feed_lines(
    session: AsyncSession,
    user_id: str,
    *,
    scope: TopicScope,
    unread_only: bool,
    offset: int,
    limit: int,
) -> tuple[list[FeedLineRow], int]:
    """One page of the user's notices and disputes merged newest first, and how many there are in all.

    Filtering, ordering (time, then id, so pages never overlap) and paging all happen in
    the database. Both queries are empty without a source in scope.
    """
    parsed_id = as_uuid(user_id)
    if parsed_id is None or not (scope.notices or (scope.disputes and not unread_only)):
        return [], 0
    lines = _feed_union(parsed_id, scope, unread_only=unread_only)
    total = await session.scalar(select(func.count()).select_from(lines))
    result = await session.execute(
        select(lines).order_by(lines.c.sort_at.desc(), lines.c.id.desc()).offset(offset).limit(limit)
    )
    return [FeedLineRow.model_validate(plain_row(row)) for row in result], int(total or 0)
