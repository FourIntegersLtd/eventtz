"""The realtime routes end to end: mint a ticket, open the stream, and get a published event.

Runs against the real app and a real Postgres (`make_actor` needs an actual
`users` row for `CurrentUser` to resolve), because `POST /stream-ticket`
authenticates the ordinary way. The stream itself never touches the database;
this proves that too, by publishing straight onto the process bus rather than
through another slice's route.

The two tests that read a live stream drive the ASGI app directly
(`open_stream`): httpx's `ASGITransport` runs the app until its body is
complete before returning a response, so `client.stream()` on an endless SSE
body never returns. Every read is bounded, so a regression fails instead of
hanging the suite.

Heartbeats are proved in `tests/unit/test_sse.py` (against a short interval
passed directly to `event_stream`), because the route's default
`HEARTBEAT_SECONDS` is bound as a default argument at import time and cannot
be shortened for one HTTP test without patching; the smoke test in the
workstream hand-off note observed one over a real connection.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
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


READ_TIMEOUT_SECONDS = 5.0


class OpenStream:
    """An SSE response read message by message as the app sends it."""

    def __init__(self, messages: asyncio.Queue[dict[str, Any]]) -> None:
        """Wrap the queue the app's ASGI `send` fills."""
        self._messages = messages
        self._unread_text = ""

    async def _next_message(self) -> dict[str, Any]:
        """The app's next ASGI message, failing the test if none arrives in time."""
        return await asyncio.wait_for(self._messages.get(), timeout=READ_TIMEOUT_SECONDS)

    async def status_code(self) -> int:
        """The status from the response's `http.response.start` message."""
        start = await self._next_message()
        assert start["type"] == "http.response.start", start
        status: int = start["status"]
        return status

    async def next_frame(self) -> str:
        """The next whole SSE frame (up to and including its blank line)."""
        while "\n\n" not in self._unread_text:
            body = await self._next_message()
            assert body["type"] == "http.response.body", body
            self._unread_text += body.get("body", b"").decode()
        whole_frame, _, self._unread_text = self._unread_text.partition("\n\n")
        return whole_frame + "\n\n"


@asynccontextmanager
async def open_stream(app: FastAPI, url: str) -> AsyncIterator[OpenStream]:
    """Run one GET against the ASGI app and expose its response as it streams, then disconnect."""
    path, _, query = url.partition("?")
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": query.encode(),
        "root_path": "",
        "headers": [(b"host", b"testserver")],
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }
    disconnected = asyncio.Event()
    request_delivered = False

    async def receive() -> dict[str, Any]:
        """Hand over the (empty) request body once, then block until the test disconnects."""
        nonlocal request_delivered
        if not request_delivered:
            request_delivered = True
            return {"type": "http.request", "body": b"", "more_body": False}
        await disconnected.wait()
        return {"type": "http.disconnect"}

    messages: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    running_app = asyncio.create_task(app(scope, receive, messages.put))
    try:
        yield OpenStream(messages)
    finally:
        disconnected.set()
        running_app.cancel()
        with suppress(asyncio.CancelledError):
            await running_app


async def test_a_signed_in_user_mints_a_ticket_and_opens_the_stream(
    app: FastAPI, client: AsyncClient, make_actor: MakeActor
) -> None:
    """The ticket-issue route works for any signed-in account, and the stream accepts its ticket."""
    access_token = await make_actor()
    issued = await client.post(
        "/api/v1/realtime/stream-ticket", headers={"Authorization": f"Bearer {access_token}"}
    )
    assert issued.status_code == 200, issued.text
    assert issued.json()["expires_in_seconds"] == get_settings().stream_ticket_ttl_seconds

    ticket = issued.json()["ticket"]
    async with open_stream(app, f"/api/v1/realtime/stream?ticket={ticket}") as stream:
        assert await stream.status_code() == 200
        assert await stream.next_frame() == frame("connected")


async def test_a_published_event_reaches_the_open_stream(
    app: FastAPI, client: AsyncClient, make_actor: MakeActor
) -> None:
    """Publishing to the ticket's user topic arrives at that user's open stream, named as sent."""
    access_token = await make_actor("stream-user@example.com")
    ticket = await stream_ticket_for(client, access_token)

    async with open_stream(app, f"/api/v1/realtime/stream?ticket={ticket}") as stream:
        assert await stream.status_code() == 200
        assert await stream.next_frame() == frame("connected")

        await get_event_bus().publish(user_topic(user_id_from(access_token)), "booking_changed")

        assert await stream.next_frame() == frame("booking_changed")


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
