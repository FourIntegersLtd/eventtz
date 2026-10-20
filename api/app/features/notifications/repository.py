"""Database access for `booking_notifications` (the in-app booking notices) and `email_delivery_log`.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.notifications.models import BookingNotification, EmailDeliveryLog
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


async def latest_notice(
    session: AsyncSession, *, booking_id: str, kinds: tuple[str, ...]
) -> tuple[str, str] | None:
    """The newest notice among `kinds` for this booking, as (kind, recipient user id)."""
    parsed_booking_id = as_uuid(booking_id)
    if parsed_booking_id is None or not kinds:
        return None
    row = (
        await session.execute(
            select(BookingNotification.kind, BookingNotification.user_id)
            .where(
                BookingNotification.booking_id == parsed_booking_id,
                BookingNotification.kind.in_(kinds),
            )
            .order_by(BookingNotification.created_at.desc(), BookingNotification.id.desc())
            .limit(1)
        )
    ).first()
    if row is None:
        return None
    return row.kind, str(row.user_id)


async def notification_exists(session: AsyncSession, *, booking_id: str, kind: str) -> bool:
    """True when this booking already has a notice of `kind` (for either party)."""
    parsed_booking_id = as_uuid(booking_id)
    if parsed_booking_id is None:
        return False
    found = await session.scalar(
        select(BookingNotification.id)
        .where(BookingNotification.booking_id == parsed_booking_id, BookingNotification.kind == kind)
        .limit(1)
    )
    return found is not None


async def insert_notification_if_absent(
    session: AsyncSession, *, user_id: str, booking_id: str, kind: str
) -> bool:
    """Add an unread notice unless the booking already has one of this kind. True when it was added."""
    parsed_user_id, parsed_booking_id = as_uuid(user_id), as_uuid(booking_id)
    if parsed_user_id is None or parsed_booking_id is None:
        return False
    inserted_id = await session.scalar(
        postgres_insert(BookingNotification)
        .values(user_id=parsed_user_id, booking_id=parsed_booking_id, kind=kind)
        .on_conflict_do_nothing(constraint="uq_booking_notifications_booking_kind")
        .returning(BookingNotification.id)
    )
    return inserted_id is not None


async def replace_notification(
    session: AsyncSession, *, user_id: str, booking_id: str, kind: str, body: str | None
) -> bool:
    """Replace the booking's notice of this kind with a fresh unread one carrying `body`.

    Delete then insert, as the baseline did, so the notice gets a new id and
    moves to the top of the feed. False when an id cannot name a row.
    """
    parsed_user_id, parsed_booking_id = as_uuid(user_id), as_uuid(booking_id)
    if parsed_user_id is None or parsed_booking_id is None:
        return False
    await session.execute(
        delete(BookingNotification).where(
            BookingNotification.booking_id == parsed_booking_id, BookingNotification.kind == kind
        )
    )
    await session.execute(
        insert(BookingNotification).values(
            user_id=parsed_user_id, booking_id=parsed_booking_id, kind=kind, body=body
        )
    )
    return True


async def claim_email_delivery(
    session: AsyncSession, *, template_id: str, recipient_email: str, recipient_user_id: str, booking_id: str
) -> bool:
    """Log a booking email as sent. False when this template already went to this person for this booking.

    The insert runs in a savepoint, so the unique-index clash that means
    "already sent" leaves the request's transaction usable.
    """
    try:
        async with session.begin_nested():
            await session.execute(
                insert(EmailDeliveryLog).values(
                    template_id=template_id,
                    recipient_email=recipient_email.strip().lower(),
                    recipient_user_id=as_uuid(recipient_user_id),
                    booking_id=as_uuid(booking_id),
                )
            )
    except IntegrityError:
        return False
    return True
