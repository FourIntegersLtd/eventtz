"""The vendor referrals "Accepted" tile counts every page, not just the one on screen."""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository
from app.features.referrals import repository

pytestmark = pytest.mark.db


async def _account(session: AsyncSession, email: str, user_type: str) -> str:
    """A verified-or-not account row; returns its id."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=None,
        account_suspended=False,
    )
    assert account_id is not None
    return account_id


async def test_accepted_total_spans_more_than_one_page(db_session: AsyncSession) -> None:
    """Of five referral bookings 3 are accepted or completed; an accepted one with no code is not counted."""
    client_id = await _account(db_session, "referral-accepted-client@example.com", "client")
    vendor_id = await _account(db_session, "referral-accepted-vendor@example.com", "vendor")
    statuses_by_code = [
        ("accepted", "123"),
        ("accepted", "123"),
        ("completed", "123"),
        ("pending", "123"),
        ("declined", "123"),
        ("accepted", None),
    ]
    for day_offset, (status, code) in enumerate(statuses_by_code, start=1):
        await bookings_repository.insert_booking(
            db_session,
            {
                "client_user_id": client_id,
                "vendor_user_id": vendor_id,
                "event_name": "Party",
                "event_date": date(2099, 7, day_offset),
                "total_label": "GBP 100.00",
                "status": status,
                "vendor_referral_code": code,
            },
        )

    first_page, total = await repository.list_referral_bookings_page(db_session, vendor_id, offset=0, limit=2)
    assert (len(first_page), total) == (2, 5)
    assert await repository.count_accepted_referral_bookings(db_session, vendor_id) == 3
    assert await repository.count_accepted_referral_bookings(db_session, client_id) == 0
