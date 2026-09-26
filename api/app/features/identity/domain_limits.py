"""In-memory rate limits for sign-in, password and verification emails. Pure (the clock is injected).

Counts live in this process only, like the baseline: enough to blunt password guessing and
email flooding without Redis. Each API worker counts separately, and a restart resets them.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from threading import Lock


@dataclass(frozen=True)
class Allowance:
    """At most `attempts` hits per key within `window_seconds`."""

    attempts: int
    window_seconds: float


class SlidingWindowLimiter:
    """Counts recent hits per key and says when a key has used up its allowance."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        """`clock` returns seconds; tests pass a fake one to move time forward."""
        self._clock = clock
        self._hits_by_key: dict[str, list[float]] = {}
        self._lock = Lock()

    def hit(self, key: str, allowance: Allowance) -> bool:
        """Record one attempt for `key`. True (and not recorded) when the key is already at its limit."""
        with self._lock:
            now = self._clock()
            cutoff = now - allowance.window_seconds
            recent = [hit_time for hit_time in self._hits_by_key.get(key, []) if hit_time >= cutoff]
            if len(recent) >= allowance.attempts:
                self._hits_by_key[key] = recent
                return True
            recent.append(now)
            self._hits_by_key[key] = recent
            return False


def ip_key(client_ip: str | None) -> str:
    """The key part for a caller's IP; callers without one share the "unknown" allowance."""
    return (client_ip or "unknown").strip() or "unknown"


# The baseline's allowances, per email (or user) and per IP.
SIGN_IN_PER_EMAIL = Allowance(attempts=10, window_seconds=15 * 60)
SIGN_IN_PER_IP = Allowance(attempts=40, window_seconds=15 * 60)
CHANGE_PASSWORD_PER_USER = Allowance(attempts=10, window_seconds=60 * 60)
CHANGE_PASSWORD_PER_IP = Allowance(attempts=30, window_seconds=60 * 60)
EMAILS_PER_ADDRESS = Allowance(attempts=5, window_seconds=60 * 60)
EMAILS_PER_IP = Allowance(attempts=20, window_seconds=60 * 60)
LINK_CLICKS_PER_IP = Allowance(attempts=30, window_seconds=60 * 60)
