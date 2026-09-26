"""`RedisEventBus` actually fans an event out across replicas, over real Redis.

`tests/unit/test_sse.py` proves `event_stream`'s relay logic against
`InProcessEventBus`, which is correct for one process only. ADR 0005's whole
reason to run Redis is the case that fixture cannot exercise: a subscriber
sitting on one replica hearing an event published from another. This test
opens two independent Redis connections against the compose Redis
(`docker-compose.yml`'s `redis` service, port 6381) and wraps each in its own
`RedisEventBus`, which is exactly what two API replicas do — each calls
`core.events.get_event_bus()` in its own process and gets its own client.

`tests/conftest.py` sets `REDIS_DISABLED=1` for every other test so the suite
never depends on Docker being up; this module opts back in for itself only,
by talking to `RedisEventBus` directly with clients built from
`Settings.redis_url`, rather than flipping the process-wide setting (which
`app.core.redis.get_redis` caches in a module-level client shared by every
other test in the session).

Writing this test against a plain `Redis.from_url(...)` (no
`decode_responses=True`, unlike `core.redis.get_redis`'s client) caught a real
bug in `RedisEventBus`'s `_listen`: it did `str(message["data"])`, which on a
bytes payload gives the literal text `"b'booking_changed'"` instead of the
decoded event name. Production never hit it because `get_redis` always sets
`decode_responses=True`, but `RedisEventBus.__init__` accepts "this Redis
client" generically, so a caller that does not opt into that config would get
silently corrupted event names. Fixed in `app.core.events._listen` to decode
bytes explicitly; `test_a_publish_on_one_replica_reaches_a_subscriber_on_another`
below is the regression assertion.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from redis.asyncio import Redis

from app.core.events import RedisEventBus, user_topic
from app.core.settings import get_settings

pytestmark = pytest.mark.redis

CONNECT_TIMEOUT_SECONDS = 1.5
READ_TIMEOUT_SECONDS = 5.0


@pytest_asyncio.fixture
async def two_redis_clients() -> AsyncIterator[tuple[Redis, Redis]]:
    """Two separate connections to the compose Redis, standing in for two API replicas.

    Skipped, not failed, when Redis is unreachable (matches the `db` fixture's
    convention in `tests/conftest.py`), so the suite stays green on a machine
    without Docker running.
    """
    redis_url = get_settings().redis_url
    replica_a = Redis.from_url(
        redis_url, socket_connect_timeout=CONNECT_TIMEOUT_SECONDS, socket_timeout=READ_TIMEOUT_SECONDS
    )
    replica_b = Redis.from_url(
        redis_url, socket_connect_timeout=CONNECT_TIMEOUT_SECONDS, socket_timeout=READ_TIMEOUT_SECONDS
    )
    try:
        await replica_a.ping()
    except Exception as error:  # noqa: BLE001 - any reason Redis is unreachable
        await replica_a.aclose()
        await replica_b.aclose()
        pytest.skip(f"No Redis for the cross-replica test (start it with `make db-up`): {error}")
    try:
        yield replica_a, replica_b
    finally:
        await replica_a.aclose()
        await replica_b.aclose()


async def test_a_publish_on_one_replica_reaches_a_subscriber_on_another(
    two_redis_clients: tuple[Redis, Redis],
) -> None:
    """Publish through one `RedisEventBus`/connection, subscribe through a second: pub/sub, not memory.

    `InProcessEventBus` would pass this test too if the two buses shared
    Python state; using two separate Redis connections rules that out and
    proves the fan-out actually left the process, which is the whole point
    of ADR 0005.
    """
    replica_a_client, replica_b_client = two_redis_clients
    publishing_replica = RedisEventBus(replica_a_client)
    subscribing_replica = RedisEventBus(replica_b_client)
    topic = user_topic("cross-replica-test-user")

    async with subscribing_replica.subscription([topic]) as events:
        # Redis pub/sub only delivers to a subscription once its SUBSCRIBE has
        # been acknowledged; a publish issued before that is simply missed,
        # so give the subscribing side a moment to actually register.
        await asyncio.sleep(0.2)
        await publishing_replica.publish(topic, "booking_changed")
        received = await asyncio.wait_for(events.__anext__(), timeout=READ_TIMEOUT_SECONDS)

    assert received == "booking_changed"


async def test_a_subscriber_on_a_different_topic_does_not_hear_it(
    two_redis_clients: tuple[Redis, Redis],
) -> None:
    """The topic is a real Redis channel name: an event for one user's topic stays off another's."""
    replica_a_client, replica_b_client = two_redis_clients
    publishing_replica = RedisEventBus(replica_a_client)
    subscribing_replica = RedisEventBus(replica_b_client)

    async with subscribing_replica.subscription([user_topic("not-the-subscriber")]) as events:
        await asyncio.sleep(0.2)
        await publishing_replica.publish(user_topic("someone-else"), "booking_changed")
        with pytest.raises(TimeoutError):
            await asyncio.wait_for(events.__anext__(), timeout=1.0)
