"""Live update stream so dashboards refresh without a full page reload."""

from __future__ import annotations

import asyncio
from typing import AsyncIterator

from fastapi import APIRouter, Request, Response
from starlette.responses import StreamingResponse

from app.features.auth.http.guards import require_user
from app.core.logging import get_logger
from app.features.realtime.sse import (
    RealtimeEvent,
    format_sse,
    register_loop,
    register_user_queue,
    unregister_user_queue,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.get("/stream")
async def realtime_stream(request: Request, response: Response) -> StreamingResponse:
    user = require_user(request, response)
    uid = str(user.get("id") or "")
    loop = asyncio.get_running_loop()
    register_loop(loop)

    q: asyncio.Queue[RealtimeEvent] = asyncio.Queue(maxsize=50)
    register_user_queue(uid, q)

    async def gen() -> AsyncIterator[str]:
        try:
            # Initial ping so the client knows we're connected.
            yield "event: connected\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    evt = await asyncio.wait_for(q.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # Keepalive comment (doesn't trigger an event handler).
                    yield ": keepalive\n\n"
                    continue
                yield format_sse(evt)
        finally:
            unregister_user_queue(uid, q)
            logger.info("realtime stream disconnected user_id=%s", uid)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

