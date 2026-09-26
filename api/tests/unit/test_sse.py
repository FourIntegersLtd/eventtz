"""`core.sse.event_stream` relays bus events as SSE frames, with heartbeats while idle.

Uses `InProcessEventBus` directly rather than Redis: the transport is swapped
by `core.events.get_event_bus`, and `event_stream` itself only depends on the
`EventBus` protocol, so this proves the relay without needing a real bus.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

from app.core.events import InProcessEventBus, flush_pending, publish_after_commit, user_topic
from app.core.sse import event_stream, frame, heartbeat_comment


def fake_session() -> Any:
    """A stand-in for `AsyncSession` that only needs the `.info` dict `publish_after_commit` writes to."""
    return SimpleNamespace(info={})


async def first_frames(stream: Any, count: int) -> list[str]:
    """Read `count` frames off an `event_stream`, then stop (the generator otherwise runs forever)."""
    collected: list[str] = []
    async for chunk in stream:
        collected.append(chunk)
        if len(collected) == count:
            return collected
    return collected


async def test_the_first_frame_is_always_connected() -> None:
    bus = InProcessEventBus()
    stream = event_stream(topics=["user:1"], bus=bus, heartbeat_seconds=5.0)
    assert await first_frames(stream, 1) == [frame("connected")]


async def test_a_published_event_reaches_the_stream_as_its_own_frame() -> None:
    bus = InProcessEventBus()
    stream = event_stream(topics=["user:1"], bus=bus, heartbeat_seconds=5.0)
    collector = asyncio.ensure_future(first_frames(stream, 2))
    await asyncio.sleep(0.05)  # let event_stream reach `bus.subscription` before publishing
    await bus.publish("user:1", "booking_changed")
    frames = await asyncio.wait_for(collector, timeout=2.0)
    assert frames == [frame("connected"), frame("booking_changed")]


async def test_publish_after_commit_reaches_a_subscribed_consumer() -> None:
    """The exact path a slice uses: queue on the session, then flush once its transaction commits."""
    bus = InProcessEventBus()
    session = fake_session()
    stream = event_stream(topics=[user_topic("user-42")], bus=bus, heartbeat_seconds=5.0)
    collector = asyncio.ensure_future(first_frames(stream, 2))
    await asyncio.sleep(0.05)

    publish_after_commit(session, user_topic("user-42"), "dispute_changed")
    # Nothing is sent until the transaction actually commits.
    assert session.info["pending_events"] == [(user_topic("user-42"), "dispute_changed")]
    await flush_pending(session, bus)

    frames = await asyncio.wait_for(collector, timeout=2.0)
    assert frames == [frame("connected"), frame("dispute_changed")]


async def test_a_subscriber_on_a_different_topic_hears_nothing() -> None:
    bus = InProcessEventBus()
    stream = event_stream(topics=["user:not-the-one"], bus=bus, heartbeat_seconds=0.05)
    frames = await first_frames(stream, 2)  # the second frame can only be a heartbeat
    await bus.publish("user:the-one", "booking_changed")
    assert frames == [frame("connected"), heartbeat_comment()]


async def test_heartbeats_appear_while_idle() -> None:
    bus = InProcessEventBus()
    stream = event_stream(topics=["user:1"], bus=bus, heartbeat_seconds=0.05)
    frames = await first_frames(stream, 3)
    assert frames == [frame("connected"), heartbeat_comment(), heartbeat_comment()]
