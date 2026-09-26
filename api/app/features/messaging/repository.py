"""Database access for conversations and messages, the tables this slice owns.

Every function takes the request's session and never commits (ADR 0002). Times
written here (`last_message_at`, read cursors) use the database clock, so a read
cursor and the messages it is compared with never disagree about "now".
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ColumnElement, and_, case, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.messaging.models import Conversation, Message
from app.features.messaging.rows import StoredMessageRow, ThreadRow

_THREAD_COLUMNS = (
    Conversation.id,
    Conversation.kind,
    Conversation.client_user_id,
    Conversation.vendor_user_id,
    Conversation.support_user_id,
    Conversation.created_at,
    Conversation.last_message_at,
)
_MESSAGE_COLUMNS = (
    Message.id,
    Message.conversation_id,
    Message.sender_user_id,
    Message.body,
    Message.created_at,
    Message.metadata_.label("metadata"),
)
# Newest activity first. Threads with no messages yet sort first, as PostgREST's
# `order(desc=True)` (NULLS FIRST) did in the baseline.
_RECENT_FIRST = (
    Conversation.last_message_at.desc().nulls_first(),
    Conversation.created_at.desc(),
    Conversation.id.desc(),
)
# The read cursors a `set_read_cursor` call may move.
_CURSOR_COLUMNS = {
    "client_last_read_at": Conversation.client_last_read_at,
    "vendor_last_read_at": Conversation.vendor_last_read_at,
    "admin_last_read_at": Conversation.admin_last_read_at,
}


def _thread(row: Any) -> ThreadRow:
    """A result row as a `ThreadRow`."""
    return ThreadRow.model_validate(plain_row(row))


def _message(row: Any) -> StoredMessageRow:
    """A result row as a `StoredMessageRow`."""
    return StoredMessageRow.model_validate(plain_row(row))


def _participant(user_id: uuid.UUID) -> ColumnElement[bool]:
    """Threads the user is on, as client, vendor or support user."""
    return or_(
        Conversation.client_user_id == user_id,
        Conversation.vendor_user_id == user_id,
        Conversation.support_user_id == user_id,
    )


async def get_thread(session: AsyncSession, conversation_id: str) -> ThreadRow | None:
    """Any conversation by id, or `None` (also for a malformed id)."""
    parsed_id = as_uuid(conversation_id)
    if parsed_id is None:
        return None
    row = (await session.execute(select(*_THREAD_COLUMNS).where(Conversation.id == parsed_id))).first()
    return _thread(row) if row else None


async def get_support_thread(session: AsyncSession, conversation_id: str) -> ThreadRow | None:
    """A support conversation by id, or `None` when it is missing or a DM."""
    thread = await get_thread(session, conversation_id)
    return thread if thread is not None and thread.kind == "support" else None


async def get_or_insert_dm(session: AsyncSession, *, client_user_id: str, vendor_user_id: str) -> ThreadRow:
    """The pair's DM thread, started now if they have none. Safe when two requests race."""
    client_id, vendor_id = uuid.UUID(client_user_id), uuid.UUID(vendor_user_id)
    await session.execute(
        insert(Conversation)
        .values(kind="dm", client_user_id=client_id, vendor_user_id=vendor_id)
        .on_conflict_do_nothing(
            index_elements=["client_user_id", "vendor_user_id"], index_where=Conversation.kind == "dm"
        )
    )
    row = (
        await session.execute(
            select(*_THREAD_COLUMNS).where(
                Conversation.kind == "dm",
                Conversation.client_user_id == client_id,
                Conversation.vendor_user_id == vendor_id,
            )
        )
    ).one()
    return _thread(row)


async def get_or_insert_support_thread(session: AsyncSession, user_id: str) -> ThreadRow | None:
    """The user's support thread, started now if they have none. `None` when the id names no account."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return None
    try:
        async with session.begin_nested():
            await session.execute(
                insert(Conversation)
                .values(kind="support", support_user_id=parsed_id)
                .on_conflict_do_nothing(
                    index_elements=["support_user_id"], index_where=Conversation.kind == "support"
                )
            )
    except IntegrityError:
        # A well-formed id with no account behind it (foreign key).
        return None
    row = (
        await session.execute(
            select(*_THREAD_COLUMNS).where(
                Conversation.kind == "support", Conversation.support_user_id == parsed_id
            )
        )
    ).one()
    return _thread(row)


async def threads_for_user(session: AsyncSession, user_id: str) -> list[ThreadRow]:
    """Every thread the user is on, newest activity first."""
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return []
    result = await session.execute(
        select(*_THREAD_COLUMNS).where(_participant(parsed_id)).order_by(*_RECENT_FIRST)
    )
    return [_thread(row) for row in result]


async def support_threads(session: AsyncSession, *, limit: int) -> list[ThreadRow]:
    """The newest support threads, for the staff inbox."""
    result = await session.execute(
        select(*_THREAD_COLUMNS).where(Conversation.kind == "support").order_by(*_RECENT_FIRST).limit(limit)
    )
    return [_thread(row) for row in result]


def _user_cursor(user_id: uuid.UUID) -> ColumnElement[Any]:
    """The user's own read cursor on each thread: the vendor's on a DM they sell on, else the client one."""
    return case(
        (
            and_(Conversation.kind != "support", Conversation.vendor_user_id == user_id),
            Conversation.vendor_last_read_at,
        ),
        else_=Conversation.client_last_read_at,
    )


async def unread_counts_for_user(session: AsyncSession, user_id: str) -> dict[str, int]:
    """Per thread the user is on: messages others sent after the user's read cursor.

    Threads with nothing unread are absent from the map.
    """
    parsed_id = as_uuid(user_id)
    if parsed_id is None:
        return {}
    cursor = _user_cursor(parsed_id)
    result = await session.execute(
        select(Conversation.id, func.count(Message.id))
        .join(Message, Message.conversation_id == Conversation.id)
        .where(
            _participant(parsed_id),
            Message.sender_user_id != parsed_id,
            or_(cursor.is_(None), Message.created_at > cursor),
        )
        .group_by(Conversation.id)
    )
    return {str(thread_id): int(unread) for thread_id, unread in result.tuples()}


async def staff_unread_counts(session: AsyncSession, conversation_ids: list[str]) -> dict[str, int]:
    """Per support thread: messages the end user sent after staff last read it."""
    parsed_ids = [parsed for parsed in (as_uuid(thread_id) for thread_id in conversation_ids) if parsed]
    if not parsed_ids:
        return {}
    result = await session.execute(
        select(Conversation.id, func.count(Message.id))
        .join(Message, Message.conversation_id == Conversation.id)
        .where(
            Conversation.id.in_(parsed_ids),
            Conversation.kind == "support",
            Message.sender_user_id == Conversation.support_user_id,
            or_(
                Conversation.admin_last_read_at.is_(None),
                Message.created_at > Conversation.admin_last_read_at,
            ),
        )
        .group_by(Conversation.id)
    )
    return {str(thread_id): int(unread) for thread_id, unread in result.tuples()}


async def latest_messages(
    session: AsyncSession, conversation_id: str, *, limit: int
) -> list[StoredMessageRow]:
    """The newest `limit` messages of a thread, returned oldest first."""
    parsed_id = as_uuid(conversation_id)
    if parsed_id is None:
        return []
    result = await session.execute(
        select(*_MESSAGE_COLUMNS)
        .where(Message.conversation_id == parsed_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
    )
    return list(reversed([_message(row) for row in result]))


async def earliest_messages(
    session: AsyncSession, conversation_id: str, *, limit: int
) -> list[StoredMessageRow]:
    """The oldest `limit` messages of a thread, oldest first (the staff chat viewer)."""
    parsed_id = as_uuid(conversation_id)
    if parsed_id is None:
        return []
    result = await session.execute(
        select(*_MESSAGE_COLUMNS)
        .where(Message.conversation_id == parsed_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .limit(limit)
    )
    return [_message(row) for row in result]


async def insert_message(
    session: AsyncSession,
    *,
    conversation_id: str,
    sender_user_id: str,
    body: str,
    metadata: dict[str, Any] | None = None,
) -> StoredMessageRow:
    """Add a message and move the thread's `last_message_at` to now. No participant checks."""
    thread_id = uuid.UUID(conversation_id)
    row = (
        await session.execute(
            insert(Message)
            .values(
                conversation_id=thread_id,
                sender_user_id=uuid.UUID(sender_user_id),
                body=body,
                metadata_=metadata,
            )
            .returning(*_MESSAGE_COLUMNS)
        )
    ).one()
    await session.execute(
        update(Conversation).where(Conversation.id == thread_id).values(last_message_at=func.now())
    )
    return _message(row)


async def get_message(
    session: AsyncSession, *, conversation_id: str, message_id: str
) -> StoredMessageRow | None:
    """One message of one thread, or `None` (also for malformed ids)."""
    thread_id, parsed_message_id = as_uuid(conversation_id), as_uuid(message_id)
    if thread_id is None or parsed_message_id is None:
        return None
    row = (
        await session.execute(
            select(*_MESSAGE_COLUMNS).where(
                Message.id == parsed_message_id, Message.conversation_id == thread_id
            )
        )
    ).first()
    return _message(row) if row else None


async def update_message(
    session: AsyncSession, *, message_id: str, body: str, metadata: dict[str, Any]
) -> StoredMessageRow:
    """Replace a message's body and metadata, returning the stored row."""
    row = (
        await session.execute(
            update(Message)
            .where(Message.id == uuid.UUID(message_id))
            .values(body=body, metadata_=metadata)
            .returning(*_MESSAGE_COLUMNS)
        )
    ).one()
    return _message(row)


async def set_read_cursor(session: AsyncSession, conversation_id: str, cursor_column: str) -> None:
    """Mark the thread read up to now for one side (`client_last_read_at`, `vendor_…` or `admin_…`)."""
    column = _CURSOR_COLUMNS[cursor_column]
    await session.execute(
        update(Conversation).where(Conversation.id == uuid.UUID(conversation_id)).values({column: func.now()})
    )
