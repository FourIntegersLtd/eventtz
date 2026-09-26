"""Server-sent events: turn a bus subscription into the wire format `EventSource` expects.

Eventtz's SSE contract (frozen from `backend/app/features/realtime/sse.py`) carries
no payload: a frame is just the business event's name, and the browser refetches
the small screen that changed through its ordinary signed-in endpoints. This is
lighter than a snapshot-per-frame stream, so this module stays a thin relay over
`core.events.EventBus` (ADR 0005) rather than OSCE's read-model replay:

- **A named frame per event**, not a rebuilt read model. `chat_unread_changed`,
  `booking_changed`, `dispute_changed` and `booking_notifications_changed` are
  the event names the web client already listens for; changing them would be a
  silent breaking change to `web/`.
- **A heartbeat.** Proxies close an idle connection at 30-60 seconds, and a
  silent close looks to a browser like a working stream with nothing happening.
  Sent as a comment line so it never fires a client's `addEventListener`.
- **`X-Accel-Buffering: no`.** Without it nginx buffers the whole response and
  the client receives nothing until the stream ends, which is never.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
from collections.abc import AsyncIterator, Sequence

from app.core.ports import EventBus

# Comfortably under the 30-60s a proxy typically waits before closing an idle connection.
HEARTBEAT_SECONDS = 25.0

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}

MEDIA_TYPE = "text/event-stream"

# The baseline never sends event data, only a name the client refetches against;
# keeping the same empty body means the wire format is unchanged, not merely the names.
_EMPTY_PAYLOAD = json.dumps({})


def frame(event: str) -> str:
    """One SSE frame for `event`, with the baseline's empty JSON body."""
    return f"event: {event}\ndata: {_EMPTY_PAYLOAD}\n\n"


def heartbeat_comment() -> str:
    """A comment line: keeps the connection open without ever matching a client's event listener."""
    return ": keepalive\n\n"


async def event_stream(
    *,
    topics: Sequence[str],
    bus: EventBus,
    heartbeat_seconds: float = HEARTBEAT_SECONDS,
) -> AsyncIterator[str]:
    """Send `connected`, then relay every event published to `topics`, heartbeating while idle.

    Subscribed before the first frame is sent, so nothing published in the gap
    between subscribing and the caller reading its first frame is missed.
    """
    yield frame("connected")

    async with bus.subscription(list(topics)) as events:
        # Draining runs on its own task so a heartbeat timeout only ever gives up on
        # the queue read, never on the subscription's own wait: cancelling an async
        # generator's `__anext__` leaves it unusable for the next read, which is a
        # stream that looks alive and has stopped.
        queued: asyncio.Queue[str] = asyncio.Queue()

        async def pump() -> None:
            """Move every event off the subscription and onto the queue this loop reads."""
            async for event_name in events:
                await queued.put(event_name)

        pumping = asyncio.create_task(pump())
        try:
            while True:
                try:
                    event_name = await asyncio.wait_for(queued.get(), timeout=heartbeat_seconds)
                except TimeoutError:
                    if pumping.done():
                        return
                    yield heartbeat_comment()
                    continue
                yield frame(event_name)
        finally:
            pumping.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await pumping
