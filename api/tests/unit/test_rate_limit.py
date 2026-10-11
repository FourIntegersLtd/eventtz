"""Counting how often one caller may try something (adapted from OSCE `test_rate_limit.py`).

Three properties, all deliberate: a caller past the allowance is refused; an
ordinary limit allows the call when Redis errors, so a cache outage does not
lock the product; a `fail_closed` limit (the credential routes) refuses when
Redis errors mid-check, since that is when a password spray would run. A
switched-off Redis allows every call. The store is passed in as a fake, so
nothing in `app` is patched.

The caller is the visitor's address: on Railway the edge's `X-Real-IP`, anywhere
else the socket peer, so a forged header never buys a fresh allowance.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from starlette.requests import Request

from app.core.rate_limit import Limit, client_ip, count_call
from app.core.settings import get_settings

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


@pytest.fixture
def on_railway(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Run as Railway does: it sets `RAILWAY_ENVIRONMENT` on every deployed service."""
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def off_railway(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Run as a laptop or any host without Railway's edge in front."""
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def http_request(peer: str | None = "10.0.0.1", **headers: str) -> Request:
    """A real Starlette request from `peer`; header names use underscores (`x_real_ip`)."""
    return Request(
        {
            "type": "http",
            "headers": [(name.replace("_", "-").encode(), value.encode()) for name, value in headers.items()],
            "client": (peer, 40000) if peer else None,
        }
    )


@pytest.mark.usefixtures("on_railway")
def test_on_railway_the_visitor_is_the_edges_x_real_ip() -> None:
    request = http_request(x_real_ip="203.0.113.9", x_forwarded_for="198.51.100.5")
    assert client_ip(request) == "203.0.113.9"


@pytest.mark.usefixtures("on_railway")
def test_on_railway_without_x_real_ip_the_visitor_is_the_first_forwarded_entry() -> None:
    assert client_ip(http_request(x_forwarded_for="198.51.100.5, 10.0.0.2")) == "198.51.100.5"


@pytest.mark.usefixtures("on_railway")
def test_on_railway_a_malformed_header_is_skipped() -> None:
    assert client_ip(http_request(x_real_ip="not-an-ip", x_forwarded_for="2001:db8::1")) == "2001:db8::1"
    assert client_ip(http_request(x_real_ip="", x_forwarded_for="garbage")) == "10.0.0.1"


@pytest.mark.usefixtures("on_railway")
def test_on_railway_with_no_headers_the_visitor_is_the_peer() -> None:
    assert client_ip(http_request(peer="10.0.0.1")) == "10.0.0.1"


@pytest.mark.usefixtures("off_railway")
def test_off_railway_the_headers_are_ignored() -> None:
    request = http_request(peer="192.0.2.10", x_real_ip="203.0.113.9", x_forwarded_for="198.51.100.5")
    assert client_ip(request) == "192.0.2.10"


@pytest.mark.usefixtures("off_railway")
def test_a_caller_with_no_address_still_gets_a_bucket() -> None:
    assert client_ip(http_request(peer=None)) == "unknown"


@pytest.mark.usefixtures("on_railway")
async def test_two_visitors_behind_the_edge_get_separate_limits() -> None:
    """Every request arrives from the same edge peer; the limit must still be per visitor."""
    store = FakeCounterStore()
    noisy = http_request(peer="10.0.0.1", x_real_ip="203.0.113.1")
    quiet = http_request(peer="10.0.0.1", x_real_ip="203.0.113.2")
    outcomes = [await count_call(store, TWO_PER_MINUTE, client_ip(noisy)) for _attempt in range(3)]
    assert outcomes == [False, False, True]
    assert await count_call(store, TWO_PER_MINUTE, client_ip(quiet)) is False


@pytest.mark.usefixtures("off_railway")
async def test_a_forged_header_does_not_dodge_a_limit_off_railway() -> None:
    store = FakeCounterStore()
    forged = [
        http_request(
            peer="192.0.2.10", x_real_ip=f"203.0.113.{attempt}", x_forwarded_for=f"198.51.100.{attempt}"
        )
        for attempt in range(3)
    ]
    outcomes = [await count_call(store, TWO_PER_MINUTE, client_ip(request)) for request in forged]
    assert outcomes == [False, False, True]
