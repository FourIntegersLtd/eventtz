"""The staff unread badge counts every support thread, not just the first page of the inbox."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import repository as identity_repository
from app.features.messaging import repository, service_support

pytestmark = [pytest.mark.db]


async def _client(session: AsyncSession, email: str) -> str:
    """A verified client account; returns its id."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type="client",
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    return account_id


async def test_total_spans_more_than_one_page_and_ignores_read_threads(db_session: AsyncSession) -> None:
    """Three threads, page size 1: 2 + 1 + 3 unread = 6, and a staff read drops one thread's share."""
    unread_per_user = {"unread-a@example.com": 2, "unread-b@example.com": 1, "unread-c@example.com": 3}
    thread_ids: dict[str, str] = {}
    for email, unread in unread_per_user.items():
        user_id = await _client(db_session, email)
        thread = await repository.get_or_insert_support_thread(db_session, user_id)
        assert thread is not None
        thread_ids[email] = thread.id
        for position in range(unread):
            await repository.insert_message(
                db_session, conversation_id=thread.id, sender_user_id=user_id, body=f"hello {position}"
            )

    first_page, total_threads = await service_support.list_support_threads_page(db_session, offset=0, limit=1)
    assert (len(first_page), total_threads) == (1, 3)
    assert await repository.staff_unread_total(db_session) == 6

    await repository.set_read_cursor(db_session, thread_ids["unread-c@example.com"], "admin_last_read_at")
    assert await repository.staff_unread_total(db_session) == 3
