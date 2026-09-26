"""Telling screens that something changed, instead of them asking every few seconds (ADR 0005).

Copied from OSCE `platform-api`. Two adapters behind the `EventBus` port:

- **Redis pub/sub**, when Redis is configured. With more than one API replica,
  a subscriber's stream is rarely on the replica that handled the write, so the
  fan-out has to leave the process.
- **In-process**, when Redis is off (tests and local development). Correct for
  one replica, and honest about being no more than that.

Events carry a name and nothing else. Subscribers rebuild their read model from
the database, so a missed event costs a reconnect rather than a wrong screen, and
no user data crosses the bus.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncIterator, Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import EventBus
from app.core.redis import get_redis

# Where a request's queued events wait on `session.info` until its transaction commits.
PENDING_KEY = "pending_events"


def user_topic(user_id: str) -> str:
    """The topic one person's screens subscribe to (their badges, inbox and bookings)."""
    return f"user:{user_id}"


def publish_after_commit(session: AsyncSession, topic: str, name: str) -> None:
    """Queue an event to go out once this request's transaction commits.

    Publishing inline would wake a subscriber before the commit; it would
    re-read the database, see the old rows, and render a stale screen. Held on
    the session, not a context variable, so the buffer cannot leak across requests.
    """
    session.info.setdefault(PENDING_KEY, []).append((topic, name))


async def flush_pending(session: AsyncSession, bus: EventBus | None = None) -> None:
    """Send what the committed transaction queued. Called by `core.db` only.

    A failure to publish is swallowed: the write is already committed, and a
    screen updating late on reconnect is better than reporting failure for work
    that succeeded.
    """
    pending: list[tuple[str, str]] = session.info.pop(PENDING_KEY, [])
    if not pending:
        return
    target_bus = bus or get_event_bus()
    for topic, name in pending:
        with contextlib.suppress(Exception):
            await target_bus.publish(topic, name)


async def _drain(queue: asyncio.Queue[str]) -> AsyncIterator[str]:
    """Yield whatever this subscriber's queue receives, forever."""
    while True:
        yield await queue.get()


async def _listen(pubsub: Any) -> AsyncIterator[str]:
    """Redis messages, one at a time.

    The one-second timeout is how the client hands control back so the
    connection can be closed when the subscriber goes away — not a poll; Redis
    buffers into the subscription so nothing is missed in between.
    """
    while True:
        message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
        if message is None:
            continue
        data = message["data"]
        # `get_redis` always builds its client with `decode_responses=True`, so
        # in production `data` already is `str`. `str(b"name")` on a client
        # without that option gives the literal text "b'name'", not the event
        # name, so decode bytes explicitly rather than assume the caller's
        # client is configured the one way production happens to configure it.
        yield data.decode() if isinstance(data, bytes) else str(data)


class InProcessEventBus:
    """One process, one set of queues. The fallback when Redis is off."""

    def __init__(self) -> None:
        """Start with no subscribers."""
        self._subscribers: dict[str, set[asyncio.Queue[str]]] = {}

    async def publish(self, topic: str, name: str) -> None:
        """Wake every current subscriber to `topic` with `name`."""
        for queue in set(self._subscribers.get(topic, ())):
            queue.put_nowait(name)

    @contextlib.asynccontextmanager
    async def subscription(self, topics: Sequence[str]) -> AsyncIterator[AsyncIterator[str]]:
        """Register a queue against these topics for as long as the caller holds it open."""
        queue: asyncio.Queue[str] = asyncio.Queue()
        for topic in topics:
            self._subscribers.setdefault(topic, set()).add(queue)
        try:
            yield _drain(queue)
        finally:
            for topic in topics:
                listeners = self._subscribers.get(topic)
                if listeners is not None:
                    listeners.discard(queue)
                    if not listeners:
                        self._subscribers.pop(topic, None)


class RedisEventBus:
    """Pub/sub, so any replica can tell a stream held by any other."""

    def __init__(self, redis: Any) -> None:
        """Publish and subscribe through this Redis client."""
        self._redis = redis

    async def publish(self, topic: str, name: str) -> None:
        """Send `name` to every subscriber of `topic` on any replica."""
        await self._redis.publish(topic, name)

    @contextlib.asynccontextmanager
    async def subscription(self, topics: Sequence[str]) -> AsyncIterator[AsyncIterator[str]]:
        """Subscribe to these topics on Redis for as long as the caller holds the subscription open."""
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(*topics)
        try:
            yield _listen(pubsub)
        finally:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe(*topics)
            with contextlib.suppress(Exception):
                await pubsub.aclose()


_in_process_bus = InProcessEventBus()


def get_event_bus() -> EventBus:
    """Redis when it is configured, one process when it is not."""
    redis = get_redis()
    return _in_process_bus if redis is None else RedisEventBus(redis)
