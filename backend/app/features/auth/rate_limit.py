"""Simple in-process rate limits (per worker). Enough to blunt abuse without Redis."""

from __future__ import annotations

import time

_buckets: dict[str, list[float]] = {}


def _prune(bucket: dict[str, list[float]], key: str, window_s: float) -> list[float]:
    cutoff = time.monotonic() - window_s
    hits = [t for t in bucket.get(key, []) if t >= cutoff]
    bucket[key] = hits
    return hits


def rate_limited(*, key: str, limit: int, window_s: float) -> bool:
    hits = _prune(_buckets, key, window_s)
    if len(hits) >= limit:
        return True
    hits.append(time.monotonic())
    _buckets[key] = hits
    return False


def assert_sign_in_rate(email: str, client_ip: str | None) -> None:
    email_key = f"signin:e:{email.strip().lower()}"
    ip_key = f"signin:ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if rate_limited(key=email_key, limit=10, window_s=900):
        raise ValueError("Too many sign-in attempts. Try again in a few minutes.")
    if rate_limited(key=ip_key, limit=40, window_s=900):
        raise ValueError("Too many sign-in attempts. Try again in a few minutes.")


def assert_change_password_rate(user_id: str, client_ip: str | None) -> None:
    user_key = f"change:e:{user_id}"
    ip_key = f"change:ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if rate_limited(key=user_key, limit=10, window_s=3600):
        raise ValueError("Too many password change attempts. Try again later.")
    if rate_limited(key=ip_key, limit=30, window_s=3600):
        raise ValueError("Too many password change attempts. Try again later.")
