"""The realtime routes end to end: mint a ticket, open the stream, and get a published event.

Runs against the real app and a real Postgres (`make_actor` needs an actual
`users` row for `CurrentUser` to resolve), because `POST /stream-ticket`
authenticates the ordinary way. The stream itself never touches the database;
this proves that too, by publishing straight onto the process bus rather than
through another slice's route.

Heartbeats are proved in `tests/unit/test_sse.py` (against a short interval
passed directly to `event_stream`), because the route's default
`HEARTBEAT_SECONDS` is bound as a default argument at import time and cannot
be shortened for one HTTP test without patching; the smoke test in the
workstream hand-off note observed one over a real connection.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.core.auth import decode_access_token, issue_stream_ticket
from app.core.events import get_event_bus, user_topic
from app.core.settings import get_settings
from app.core.sse import frame
from tests.conftest import MakeActor

pytestmark = [pytest.mark.db, pytest.mark.e2e]


def user_id_from(access_token: str) -> str:
    """The `sub` claim of a Bearer token minted by `make_actor`, so a test can publish to it."""
    claims = decode_access_token(access_token, settings=get_settings())
    assert claims is not None
    return claims.user_id


async def stream_ticket_for(client: AsyncClient, access_token: str) -> str:
    """Mint a stream ticket over HTTP the way a signed-in browser would."""
    issued = await client.post(
        "/api/v1/realtime/stream-ticket", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert issued.status_code == 200, issued.text
    ticket: str = issued.json()["ticket"]
    return ticket


async def next_lines(lines: AsyncIterator[str], count: int) -> list[str]:
    """The next `count` lines off an SSE body's line iterator."""
    return [await anext(lines) for _ in range(count)]


async def test_a_signed_in_user_mints_a_ticket_and_opens_the_stream(
    client: AsyncClient, make_actor: MakeActor
) -> None:
    """The ticket-issue route works for any signed-in account, and the stream accepts its ticket."""
    access_token = await make_actor()
    issued = await client.post(
        "/api/v1/realtime/stream-ticket", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert issued.status_code == 200, issued.text
    assert issued.json()["expires_in_seconds"] == get_settings().stream_ticket_ttl_seconds

    ticket = issued.json()["ticket"]
    async with client.stream("GET", f"/api/v1/realtime/stream?ticket={ticket}") as response:
        assert response.status_code == 200
        first_line = await anext(response.aiter_lines())
        assert first_line == "event: connected"


async def test_a_published_event_reaches_the_open_stream(client: AsyncClient, make_actor: MakeActor) -> None:
    """Publishing to the ticket's user topic arrives at that user's open stream, named as sent."""
    access_token = await make_actor("stream-user@example.com")
    ticket = await stream_ticket_for(client, access_token)

    async with client.stream("GET", f"/api/v1/realtime/stream?ticket={ticket}") as response:
        lines = response.aiter_lines()
        await next_lines(lines, 2)  # "event: connected" and its "data: {}"

        await get_event_bus().publish(user_topic(user_id_from(access_token)), "booking_changed")

        event_and_data = await next_lines(lines, 2)
        assert "\n".join(event_and_data) + "\n" == frame("booking_changed").rstrip("\n")


async def test_a_missing_ticket_is_refused(client: AsyncClient) -> None:
    """No `ticket` query parameter at all is the same refusal as a bad one."""
    refused = await client.get("/api/v1/realtime/stream")
    assert (refused.status_code, refused.json()["code"]) == (401, "invalid_stream_ticket")


async def test_an_expired_ticket_is_refused(client: AsyncClient) -> None:
    """A ticket minted more than `stream_ticket_ttl_seconds` ago is refused like a missing one."""
    settings = get_settings()
    minted_in_the_past = datetime.now(UTC) - timedelta(seconds=settings.stream_ticket_ttl_seconds + 5)
    expired_ticket = issue_stream_ticket(user_id="whoever", settings=settings, now=minted_in_the_past)

    refused = await client.get(f"/api/v1/realtime/stream?ticket={expired_ticket}")
    assert (refused.status_code, refused.json()["code"]) == (401, "invalid_stream_ticket")


async def test_an_access_token_used_as_a_ticket_is_refused(
    client: AsyncClient, make_actor: MakeActor
) -> None:
    """A signed-in user's ordinary Bearer token must not double as a stream ticket: `typ` differs."""
    access_token = await make_actor("wrong-token-type-user@example.com")
    refused = await client.get(f"/api/v1/realtime/stream?ticket={access_token}")
    assert (refused.status_code, refused.json()["code"]) == (401, "invalid_stream_ticket")
