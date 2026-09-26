"""Counting how often one caller may try something (adapted from OSCE `test_rate_limit.py`).

Three properties, all deliberate: a caller past the allowance is refused; an
ordinary limit allows the call when Redis errors, so a cache outage does not
lock the product; a `fail_closed` limit (the credential routes) refuses when
Redis errors mid-check, since that is when a password spray would run. A
switched-off Redis allows every call. The store is passed in as a fake, so
nothing in `app` is patched.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from app.core.rate_limit import Limit, caller_key, count_call

TWO_PER_MINUTE = Limit(name="test", allowance=2, window_seconds=60)
STRICT_TWO_PER_MINUTE = Limit(name="sign-in", allowance=2, window_seconds=60, fail_closed=True)


class FakeCounterStore:
    """Enough of Redis to count. Raises on demand, to prove each failure mode."""

    def __init__(self, *, broken: bool = False) -> None:
        """Start with no counters; `broken` makes every command fail."""
        self.counts: dict[str, int] = {}
        self.expiries: list[tuple[str, int]] = []
        self.broken = broken

    async def incr(self, name: str) -> int:
        """Add one to a counter, like Redis `INCR`."""
        if self.broken:
            raise ConnectionError("redis is down")
        self.counts[name] = self.counts.get(name, 0) + 1
        return self.counts[name]

    async def expire(self, name: str, time: int) -> bool:
        """Record the expiry the limiter asked for."""
        self.expiries.append((name, time))
        return True


def fake_request(host: str | None = "203.0.113.1", forwarded: str | None = None) -> Any:
    """The two request attributes `caller_key` reads."""
    return SimpleNamespace(
        headers={"x-forwarded-for": forwarded} if forwarded else {},
        client=SimpleNamespace(host=host) if host else None,
    )


async def test_calls_inside_the_allowance_pass_and_the_next_is_refused() -> None:
    store = FakeCounterStore()
    outcomes = [await count_call(store, TWO_PER_MINUTE, "caller") for _attempt in range(3)]
    assert outcomes == [False, False, True]


async def test_one_caller_does_not_spend_anothers_allowance() -> None:
    store = FakeCounterStore()
    for _attempt in range(3):
        await count_call(store, TWO_PER_MINUTE, "noisy")
    assert await count_call(store, TWO_PER_MINUTE, "quiet") is False
    assert set(store.counts) == {"ratelimit:test:noisy", "ratelimit:test:quiet"}


async def test_the_window_is_set_once_per_window() -> None:
    """Otherwise a burst keeps pushing the window out in front of itself and never resets."""
    store = FakeCounterStore()
    for _attempt in range(3):
        await count_call(store, TWO_PER_MINUTE, "caller")
    assert store.expiries == [("ratelimit:test:caller", 60)]


async def test_a_broken_store_allows_an_ordinary_call() -> None:
    store = FakeCounterStore(broken=True)
    outcomes = {await count_call(store, TWO_PER_MINUTE, "caller") for _attempt in range(10)}
    assert outcomes == {False}


async def test_a_fail_closed_limit_refuses_when_the_store_errors() -> None:
    assert await count_call(FakeCounterStore(broken=True), STRICT_TWO_PER_MINUTE, "caller") is True


async def test_no_store_at_all_allows_even_a_fail_closed_limit() -> None:
    """`REDIS_DISABLED` is a supported deployment, and it must not mean "no sign-ins"."""
    outcomes = {await count_call(None, STRICT_TWO_PER_MINUTE, "caller") for _attempt in range(10)}
    assert outcomes == {False}


def test_the_caller_is_the_client_address() -> None:
    assert caller_key(fake_request(host="203.0.113.7")) == "203.0.113.7"


def test_a_proxied_caller_is_the_address_our_proxy_saw() -> None:
    """With one trusted hop the caller is the rightmost entry, not the leftmost the caller wrote."""
    assert caller_key(fake_request(host="10.0.0.1", forwarded="203.0.113.9, 198.51.100.5")) == "198.51.100.5"


def test_a_spoofed_leading_address_does_not_mint_a_fresh_bucket() -> None:
    first = fake_request(host="10.0.0.1", forwarded="1.1.1.1, 198.51.100.5")
    second = fake_request(host="10.0.0.1", forwarded="2.2.2.2, 198.51.100.5")
    assert caller_key(first) == caller_key(second) == "198.51.100.5"


def test_a_caller_with_no_address_still_gets_a_bucket() -> None:
    assert caller_key(fake_request(host=None)) == "unknown"
