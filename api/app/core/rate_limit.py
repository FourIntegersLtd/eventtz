"""How often one caller may do something (ADR 0009; shape copied from OSCE `platform-api`).

Only on the routes where an attacker gains something by repeating: signing in,
password and verification emails, and one-click links. Each slice keeps its own
allowances and its own 429 error; this module only counts.

**Mostly it fails open.** An unconfigured or switched-off Redis allows the call:
turning the limiter off is a deployment choice, and a cache outage must not stop
the whole product working. The exception is a `fail_closed` limit — the
credential routes — which refuses the call when Redis is reachable but *errors
mid-check*, since that is exactly the moment a password spray would be running.

The counter is a fixed window rather than a sliding one: two windows' allowance
can land in one burst at the boundary, a distinction no attacker profits from and
a great deal less state to keep.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Protocol

from fastapi import Depends, Request
from redis.asyncio import Redis

from app.core.logging import get_logger
from app.core.redis import get_redis
from app.core.settings import get_settings

log = get_logger(__name__)

KEY_PREFIX = "ratelimit"


@dataclass(frozen=True)
class Limit:
    """`allowance` calls per `window_seconds`, per caller, counted under `name`.

    `fail_closed` decides what happens when Redis is *reachable but errors* mid
    check: a credential-guessing route refuses the call rather than let the
    limiter silently switch off under load.
    """

    name: str
    allowance: int
    window_seconds: int
    fail_closed: bool = False


def caller_key(request: Request) -> str:
    """Who is being counted: the caller's address as our own proxy saw it.

    `X-Forwarded-For` is `client, proxy1, …, ourproxy`, each hop appending the
    address it saw. The leftmost entry is written by the caller and can say
    anything, so counting by it lets an attacker mint a fresh bucket per forged
    address. We count instead by the entry `trusted_proxy_hops` from the right.
    With no proxy in front (the header absent) this is the socket peer.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        addresses = [address.strip() for address in forwarded.split(",") if address.strip()]
        if addresses:
            hops = max(get_settings().trusted_proxy_hops, 1)
            # `addresses[-hops]` when the chain is long enough; otherwise the
            # leftmost, which is as far back as the header reaches.
            position = -hops if hops <= len(addresses) else 0
            return addresses[position]
    return request.client.host if request.client else "unknown"


# What routers declare as a parameter type: `def sign_in(body: ..., caller: CallerKey)`.
CallerKey = Annotated[str, Depends(caller_key)]


class CounterStore(Protocol):
    """The two Redis commands the limiter uses; tests pass a fake with the same shape."""

    async def incr(self, name: str) -> int:
        """Add one to the counter and return its new value (a missing key starts at 0)."""
        ...

    async def expire(self, name: str, time: int) -> bool:
        """Delete the counter after `time` seconds."""
        ...


async def is_over_limit(limit: Limit, caller: str) -> bool:
    """Count this call for `caller` in the shared Redis; see `count_call`."""
    return await count_call(get_redis(), limit, caller)


async def count_call(client: Redis | CounterStore | None, limit: Limit, caller: str) -> bool:
    """Count this call for `caller`; True when it goes past the window's allowance.

    False when there is no store (Redis off). When the store errors, True only
    for a `fail_closed` limit.
    """
    if client is None:
        return False
    key = f"{KEY_PREFIX}:{limit.name}:{caller}"
    try:
        used = await client.incr(key)
        if used == 1:
            # Only the first call in a window sets the expiry, so a burst cannot
            # keep pushing the window out in front of itself.
            await client.expire(key, limit.window_seconds)
    except Exception as error:  # noqa: BLE001 - a Redis failure mid-check
        log.warning("rate limit unavailable limit=%s error=%s", limit.name, error)
        return limit.fail_closed
    return int(used) > limit.allowance
