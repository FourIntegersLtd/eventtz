"""`dispute_changed` reaches exactly the people the baseline notifies, and only after a commit.

Subscribes to the in-process bus (what the realtime stream reads), then drives the
real dispute routes. The patch recipients mirror
`backend/app/features/admin/dispute_admin_commands.py`: a note-only patch wakes only
the party whose note was set; every other patch wakes both.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_access_token, issue_access_token
from app.core.events import get_event_bus, user_topic
from app.core.ports import mailer_port
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository
from tests.conftest import MakeActor
from tests.support.fakes import FakeMailer

pytestmark = [pytest.mark.db, pytest.mark.e2e]

SUMMARY = "The caterer never arrived at the venue."


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
            "event_name": "Dispute realtime party",
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


@contextlib.asynccontextmanager
async def listening(*user_ids: str) -> AsyncIterator[dict[str, AsyncIterator[str]]]:
    """One bus subscription per user, so a test can tell who was woken."""
    async with contextlib.AsyncExitStack() as stack:
        streams = {
            user_id: await stack.enter_async_context(get_event_bus().subscription([user_topic(user_id)]))
            for user_id in user_ids
        }
        yield streams


async def heard(stream: AsyncIterator[str]) -> list[str]:
    """Every event waiting on the stream (the in-process bus delivers synchronously on commit)."""
    events: list[str] = []
    while True:
        try:
            events.append(await asyncio.wait_for(stream.__anext__(), timeout=0.2))
        except TimeoutError:
            return events


async def _open_dispute(client: AsyncClient, headers: dict[str, str], booking_id: str) -> str:
    """Open a dispute over HTTP; returns its id."""
    opened = await client.post(
        f"/api/v1/client/booking-requests/{booking_id}/disputes", json={"summary": SUMMARY}, headers=headers
    )
    assert opened.status_code == 200, opened.text
    dispute_id: str = opened.json()["dispute"]["id"]
    return dispute_id


async def test_opening_a_dispute_wakes_both_parties_and_nobody_else(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    client_id, client_headers = await _account(db_session, "client@example.com", "client")
    vendor_id, _ = await _account(db_session, "vendor@example.com", "vendor")
    bystander_id, _ = await _account(db_session, "bystander@example.com", "client")
    booking_id = await _booking(db_session, client_id, vendor_id)

    async with listening(client_id, vendor_id, bystander_id) as streams:
        await _open_dispute(client, client_headers, booking_id)
        assert await heard(streams[client_id]) == ["dispute_changed"]
        assert await heard(streams[vendor_id]) == ["dispute_changed"]
        assert await heard(streams[bystander_id]) == []


async def test_a_rejected_dispute_wakes_nobody(client: AsyncClient, db_session: AsyncSession) -> None:
    client_id, client_headers = await _account(db_session, "client@example.com", "client")
    vendor_id, _ = await _account(db_session, "vendor@example.com", "vendor")
    booking_id = await _booking(db_session, client_id, vendor_id)

    async with listening(client_id, vendor_id) as streams:
        too_short = await client.post(
            f"/api/v1/client/booking-requests/{booking_id}/disputes",
            json={"summary": "short"},
            headers=client_headers,
        )
        assert too_short.status_code == 422
        assert await heard(streams[client_id]) == []
        assert await heard(streams[vendor_id]) == []


@pytest.mark.parametrize(
    ("patch", "client_hears", "vendor_hears"),
    [
        ({"status": "under_review"}, True, True),
        ({"internal_notes": "Called the vendor."}, True, True),
        ({"client_resolution_note": "We are looking into it."}, True, False),
        ({"vendor_resolution_note": "Please send your side."}, False, True),
        ({"client_resolution_note": "a", "vendor_resolution_note": "b"}, True, True),
        ({"client_resolution_note": "a", "status": "under_review"}, True, True),
    ],
    ids=["status", "internal-notes", "client-note", "vendor-note", "both-notes", "note-with-status"],
)
async def test_a_staff_patch_wakes_exactly_the_baseline_recipients(
    client: AsyncClient,
    db_session: AsyncSession,
    make_actor: MakeActor,
    patch: dict[str, Any],
    client_hears: bool,
    vendor_hears: bool,
) -> None:
    client_id, client_headers = await _account(db_session, "client@example.com", "client")
    vendor_id, _ = await _account(db_session, "vendor@example.com", "vendor")
    booking_id = await _booking(db_session, client_id, vendor_id)
    dispute_id = await _open_dispute(client, client_headers, booking_id)
    staff_token = await make_actor("staff@example.com", user_type="admin", admin_role="admin")
    assert decode_access_token(staff_token, settings=get_settings()) is not None

    async with listening(client_id, vendor_id) as streams:
        patched = await client.patch(
            f"/api/v1/admin/disputes/{dispute_id}",
            json=patch,
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        assert patched.status_code == 200, patched.text
        assert await heard(streams[client_id]) == (["dispute_changed"] if client_hears else [])
        assert await heard(streams[vendor_id]) == (["dispute_changed"] if vendor_hears else [])


async def test_a_rejected_staff_patch_wakes_nobody(
    client: AsyncClient, db_session: AsyncSession, make_actor: MakeActor
) -> None:
    client_id, client_headers = await _account(db_session, "client@example.com", "client")
    vendor_id, _ = await _account(db_session, "vendor@example.com", "vendor")
    booking_id = await _booking(db_session, client_id, vendor_id)
    dispute_id = await _open_dispute(client, client_headers, booking_id)
    staff_token = await make_actor("staff@example.com", user_type="admin", admin_role="admin")

    async with listening(client_id, vendor_id) as streams:
        empty = await client.patch(
            f"/api/v1/admin/disputes/{dispute_id}",
            json={},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        assert empty.status_code == 400
        assert await heard(streams[client_id]) == []
        assert await heard(streams[vendor_id]) == []


async def test_opening_a_dispute_emails_staff_the_baseline_alert(
    client: AsyncClient, db_session: AsyncSession, app: FastAPI
) -> None:
    mailer = FakeMailer()
    app.dependency_overrides[mailer_port] = lambda: mailer
    client_id, client_headers = await _account(db_session, "client@example.com", "client")
    vendor_id, _ = await _account(db_session, "vendor@example.com", "vendor")
    booking_id = await _booking(db_session, client_id, vendor_id)

    dispute_id = await _open_dispute(client, client_headers, booking_id)

    (email,) = mailer.sent
    assert email.subject == f"[Eventtz ops] Dispute opened | booking {booking_id[:8]}"
    assert email.to == tuple(get_settings().admin_alert_emails_list)
    for expected in (
        "Dispute opened",
        booking_id,
        dispute_id,
        "client@example.com",
        SUMMARY,
        "https://www.eventtz.com/admin/disputes",
        "Open in admin",
    ):
        assert expected in email.html
        assert expected in email.text or expected == "Dispute opened"


async def test_a_failing_mailer_does_not_stop_a_dispute_opening(
    client: AsyncClient, db_session: AsyncSession, app: FastAPI
) -> None:
    class ExplodingMailer:
        """A provider that raises instead of answering."""

        def send(self, email: object) -> bool:
            """Always fail."""
            raise RuntimeError("provider down")

    app.dependency_overrides[mailer_port] = lambda: ExplodingMailer()
    client_id, client_headers = await _account(db_session, "client@example.com", "client")
    vendor_id, _ = await _account(db_session, "vendor@example.com", "vendor")
    booking_id = await _booking(db_session, client_id, vendor_id)
    assert await _open_dispute(client, client_headers, booking_id)
