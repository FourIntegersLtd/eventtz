"""The request's unit of work ends before its response is sent.

Otherwise a failed commit follows a 200 the client already has, and the
client's next request can read the database before the write landed.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI

from app.core.db import SessionDep, get_session


async def test_the_session_closes_before_the_response_starts() -> None:
    events: list[str] = []

    async def recording_session() -> AsyncIterator[Any]:
        """Stands in for `get_session`, noting when its commit would run."""
        yield object()
        events.append("commit")

    app = FastAPI()
    app.dependency_overrides[get_session] = recording_session

    @app.post("/write")
    async def write(session: SessionDep) -> dict[str, bool]:
        """A handler that uses the request session."""
        events.append("handler")
        return {"saved": True}

    async def receive() -> dict[str, Any]:
        """An empty request body."""
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, Any]) -> None:
        """Note when the response starts going out."""
        if message["type"] == "http.response.start":
            events.append("response")

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/write",
        "raw_path": b"/write",
        "root_path": "",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 1),
        "server": ("testserver", 80),
    }
    await app(scope, receive, send)

    assert events == ["handler", "commit", "response"]
