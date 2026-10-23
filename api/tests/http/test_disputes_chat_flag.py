"""A dispute answer says whether a chat thread was linked for staff review (the baseline sent it)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import issue_access_token
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository

pytestmark = [pytest.mark.db, pytest.mark.e2e]


async def _account(session: AsyncSession, email: str, user_type: str) -> tuple[str, dict[str, str]]:
    """A verified account: (id, Bearer header)."""
    account_id = await identity_repository.create_account(
        session,
        email=email,
        user_type=user_type,
        admin_role=None,
        email_verified_at=datetime.now(UTC),
        account_suspended=False,
    )
    assert account_id is not None
    token = issue_access_token(user_id=account_id, email=email, settings=get_settings())
    return account_id, {"Authorization": f"Bearer {token}"}


async def _booking(session: AsyncSession, client_id: str, vendor_id: str) -> str:
    """An accepted booking between the two."""
    booking = await bookings_repository.insert_booking(
        session,
        {
            "client_user_id": client_id,
            "vendor_user_id": vendor_id,
            "event_name": "Chat flag party",
            "event_date": "2099-06-01",
            "event_address": "1 Test Street, London",
            "status": "accepted",
            "payment_status": "unpaid",
            "initiator": "client",
            "total_label": "GBP 150",
            "selected_option_ids": [],
            "line_items": [],
            "vendor_adjustments": [],
        },
    )
    return booking.id


async def _open(client: AsyncClient, headers: dict[str, str], booking_id: str) -> dict[str, object]:
    """Open a dispute and return the participant-facing dispute."""
    opened = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/disputes",
        json={"summary": "The caterer never arrived at the venue."},
        headers=headers,
    )
    assert opened.status_code == 200, opened.text
    dispute: dict[str, object] = opened.json()["dispute"]
    return dispute


async def test_dispute_without_a_chat_thread_says_chat_was_not_included(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    client_id, headers = await _account(db_session, "chatflag-client-a@example.com", "client")
    vendor_id, _ = await _account(db_session, "chatflag-vendor-a@example.com", "vendor")
    booking_id = await _booking(db_session, client_id, vendor_id)

    dispute = await _open(client, headers, booking_id)

    assert dispute["chat_included_for_review"] is False


async def test_dispute_with_a_chat_thread_says_chat_was_included(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    client_id, headers = await _account(db_session, "chatflag-client-b@example.com", "client")
    vendor_id, _ = await _account(db_session, "chatflag-vendor-b@example.com", "vendor")
    booking_id = await _booking(db_session, client_id, vendor_id)
    await db_session.execute(
        text("insert into conversations (client_user_id, vendor_user_id) values (:client, :vendor)"),
        {"client": client_id, "vendor": vendor_id},
    )

    dispute = await _open(client, headers, booking_id)

    assert dispute["chat_included_for_review"] is True
    listed = await client.get(f"/api/v1/client/booking-requests/{booking_id}/disputes", headers=headers)
    assert listed.json()["disputes"][0]["chat_included_for_review"] is True
