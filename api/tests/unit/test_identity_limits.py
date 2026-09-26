"""The in-memory sliding-window rate limiter, driven by a fake clock."""

from __future__ import annotations

from app.features.identity.domain_limits import Allowance, SlidingWindowLimiter, ip_key


class FakeClock:
    """A clock the test moves forward by hand."""

    def __init__(self) -> None:
        """Start at zero seconds."""
        self.seconds = 0.0

    def __call__(self) -> float:
        """The current fake time."""
        return self.seconds


THREE_PER_MINUTE = Allowance(attempts=3, window_seconds=60)


def test_a_key_is_limited_after_its_allowance() -> None:
    """The first three hits pass; the fourth is refused."""
    limiter = SlidingWindowLimiter(clock=FakeClock())
    outcomes = [limiter.hit("sign-in:ada", THREE_PER_MINUTE) for _attempt in range(4)]
    assert outcomes == [False, False, False, True]


def test_keys_are_counted_separately() -> None:
    """One noisy email does not limit another."""
    limiter = SlidingWindowLimiter(clock=FakeClock())
    for _attempt in range(3):
        limiter.hit("sign-in:ada", THREE_PER_MINUTE)
    assert limiter.hit("sign-in:ada", THREE_PER_MINUTE)
    assert not limiter.hit("sign-in:bea", THREE_PER_MINUTE)


def test_old_hits_fall_out_of_the_window() -> None:
    """Once the oldest hit is older than the window, a new attempt is allowed."""
    clock = FakeClock()
    limiter = SlidingWindowLimiter(clock=clock)
    for second in (0.0, 10.0, 20.0):
        clock.seconds = second
        limiter.hit("key", THREE_PER_MINUTE)
    clock.seconds = 59.0
    assert limiter.hit("key", THREE_PER_MINUTE)
    clock.seconds = 61.0
    assert not limiter.hit("key", THREE_PER_MINUTE)


def test_refused_attempts_do_not_extend_the_lockout() -> None:
    """Hammering while limited is not recorded, so the key frees up on schedule."""
    clock = FakeClock()
    limiter = SlidingWindowLimiter(clock=clock)
    for _attempt in range(3):
        limiter.hit("key", THREE_PER_MINUTE)
    for second in range(1, 50):
        clock.seconds = float(second)
        assert limiter.hit("key", THREE_PER_MINUTE)
    clock.seconds = 61.0
    assert not limiter.hit("key", THREE_PER_MINUTE)


def test_callers_without_an_ip_share_one_key() -> None:
    """Missing or blank IPs count against "unknown"."""
    assert ip_key(None) == "unknown"
    assert ip_key("  ") == "unknown"
    assert ip_key(" 10.0.0.1 ") == "10.0.0.1"
