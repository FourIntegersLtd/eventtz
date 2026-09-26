"""Database access for `booking_notifications`, the in-app booking notices.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.notifications.models import BookingNotification
from app.features.notifications.rows import StoredNotificationRow


async def latest_for_user(session: AsyncSession, user_id: str, *, limit: int) -> list[StoredNotificationRow]:
    """The user's newest notices, newest first."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return []
    result = await session.execute(
        select(
            BookingNotification.id,
            BookingNotification.booking_id,
            BookingNotification.kind,
            BookingNotification.body,
            BookingNotification.read_at,
            BookingNotification.created_at,
        )
        .where(BookingNotification.user_id == parsed_id)
        .order_by(BookingNotification.created_at.desc(), BookingNotification.id.desc())
        .limit(limit)
    )
    return [StoredNotificationRow.model_validate(plain_row(row)) for row in result]


async def count_unread(session: AsyncSession, user_id: str) -> int:
    """How many of the user's notices they have not read."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return 0
    unread = await session.scalar(
        select(func.count(BookingNotification.id)).where(
            BookingNotification.user_id == parsed_id, BookingNotification.read_at.is_(None)
        )
    )
    return int(unread or 0)


async def mark_all_read(session: AsyncSession, user_id: str) -> None:
    """Stamp every unread notice of the user as read now (already-read ones keep their time)."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return
    await session.execute(
        update(BookingNotification)
        .where(BookingNotification.user_id == parsed_id, BookingNotification.read_at.is_(None))
        .values(read_at=func.now())
    )


async def mark_read(session: AsyncSession, *, user_id: str, notification_id: str) -> bool:
    """Stamp one of the user's notices read now. False when the id names none of theirs."""
    parsed_user_id, parsed_notification_id = as_uuid(user_id), as_uuid(notification_id)
    if parsed_user_id is None or parsed_notification_id is None:
        return False
    updated_id = await session.scalar(
        update(BookingNotification)
        .where(
            BookingNotification.id == parsed_notification_id, BookingNotification.user_id == parsed_user_id
        )
        .values(read_at=func.now())
        .returning(BookingNotification.id)
    )
    return updated_id is not None
