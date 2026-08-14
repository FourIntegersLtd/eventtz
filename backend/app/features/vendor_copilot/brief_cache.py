"""Fingerprint and in-memory LLM narration cache for vendor daily brief."""

from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

from app.core.config import get_settings


@dataclass(frozen=True)
class BriefNarrationCacheEntry:
    greeting: str
    summary_markdown: str


_NARRATION_CACHE: dict[str, tuple[float, BriefNarrationCacheEntry]] = {}
_inflight: dict[str, threading.Event] = {}
_inflight_lock = threading.Lock()
_cache_lock = threading.Lock()


def compute_brief_fingerprint(ctx: dict[str, Any]) -> str:
    """Stable hash of vendor facts that affect brief actions and narration."""
    overview = ctx.get("analytics_overview")
    if not isinstance(overview, dict):
        overview = {}

    pending = ctx.get("pending_bookings") or []
    pending_ids = sorted(
        str(b.get("id") or "")
        for b in pending
        if isinstance(b, dict) and b.get("id")
    )

    avg_resp = overview.get("avg_response_seconds")
    conv = overview.get("conversion_rate")

    payload = {
        "growth_score": ctx.get("growth_score"),
        "growth_levers": ctx.get("growth_levers"),
        "listing_visible": ctx.get("listing_visible"),
        "payouts_verified": ctx.get("payouts_verified"),
        "approval_status": ctx.get("approval_status"),
        "pending_ids": pending_ids,
        "overview": {
            "pending_enquiries": overview.get("pending_enquiries"),
            "expired_enquiries": overview.get("expired_enquiries"),
            "enquiries": overview.get("enquiries"),
            "profile_views": overview.get("profile_views"),
            "review_count": overview.get("review_count"),
            "avg_response_seconds": round(float(avg_resp or 0)),
            "conversion_rate": round(float(conv or 0), 2),
        },
        "profile_summary": ctx.get("payload_summary"),
        "profile_updated_at": ctx.get("profile_updated_at"),
        "business_name": ctx.get("business_name"),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _cache_key(vendor_user_id: str, fingerprint: str) -> str:
    return f"{vendor_user_id}:{fingerprint}"


def narration_cache_get(vendor_user_id: str, fingerprint: str) -> BriefNarrationCacheEntry | None:
    settings = get_settings()
    ttl = max(0, int(settings.openai_copilot_brief_cache_ttl_seconds))
    key = _cache_key(vendor_user_id, fingerprint)
    with _cache_lock:
        entry = _NARRATION_CACHE.get(key)
        if not entry:
            return None
        expires_at, narration = entry
        if ttl <= 0 or time.monotonic() > expires_at:
            _NARRATION_CACHE.pop(key, None)
            return None
        return narration


def narration_cache_set(
    vendor_user_id: str,
    fingerprint: str,
    narration: BriefNarrationCacheEntry,
) -> None:
    settings = get_settings()
    ttl = max(0, int(settings.openai_copilot_brief_cache_ttl_seconds))
    if ttl <= 0:
        return
    max_entries = max(1, int(settings.openai_copilot_brief_cache_max_entries))
    key = _cache_key(vendor_user_id, fingerprint)
    with _cache_lock:
        if len(_NARRATION_CACHE) >= max_entries:
            oldest_key = min(_NARRATION_CACHE, key=lambda k: _NARRATION_CACHE[k][0])
            _NARRATION_CACHE.pop(oldest_key, None)
        _NARRATION_CACHE[key] = (time.monotonic() + ttl, narration)


def get_or_compute_narration(
    vendor_user_id: str,
    fingerprint: str,
    compute: Callable[[], BriefNarrationCacheEntry],
) -> tuple[BriefNarrationCacheEntry, bool]:
    """Return (narration, was_cached). Singleflight on cache miss."""
    cached = narration_cache_get(vendor_user_id, fingerprint)
    if cached is not None:
        return cached, True

    key = _cache_key(vendor_user_id, fingerprint)
    wait_event: threading.Event | None = None
    is_leader = False

    with _inflight_lock:
        cached = narration_cache_get(vendor_user_id, fingerprint)
        if cached is not None:
            return cached, True
        if key in _inflight:
            wait_event = _inflight[key]
        else:
            wait_event = threading.Event()
            _inflight[key] = wait_event
            is_leader = True

    if not is_leader and wait_event is not None:
        wait_event.wait(timeout=120)
        cached = narration_cache_get(vendor_user_id, fingerprint)
        if cached is not None:
            return cached, True

    try:
        narration = compute()
        narration_cache_set(vendor_user_id, fingerprint, narration)
        return narration, False
    finally:
        if is_leader and wait_event is not None:
            with _inflight_lock:
                _inflight.pop(key, None)
                wait_event.set()


def clear_narration_cache_for_tests() -> None:
    """Reset in-memory cache (unit tests only)."""
    with _cache_lock:
        _NARRATION_CACHE.clear()
    with _inflight_lock:
        _inflight.clear()
