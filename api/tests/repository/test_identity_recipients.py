"""Who the live vendor-terms mass email goes to (`open_emails_of_type`)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.identity import repository

pytestmark = pytest.mark.db


async def make_account(session: AsyncSession, email: str, user_type: str) -> str:
    """Write a `users` row."""
    account_id = await repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=None,
        account_suspended=False,
    )
    assert account_id is not None
    return account_id


async def test_only_open_vendors_with_an_email_are_recipients(db_session: AsyncSession) -> None:
    """Open vendors are in; closed vendors, clients and vendors without an email are out."""
    await make_account(db_session, "b-open@example.com", "vendor")
    await make_account(db_session, "a-open@example.com", "vendor")
    closed_id = await make_account(db_session, "closed@example.com", "vendor")
    await db_session.execute(
        text("UPDATE users SET deleted_at = :closed_at WHERE id = :id"),
        {"closed_at": datetime.now(UTC), "id": closed_id},
    )
    await make_account(db_session, "client@example.com", "client")
    await db_session.execute(text("INSERT INTO users (user_type) VALUES ('vendor')"))  # no email

    assert await repository.open_emails_of_type(db_session, user_type="vendor") == [
        "a-open@example.com",
        "b-open@example.com",
    ]
