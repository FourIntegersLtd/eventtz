"""Extract normalized 0–1 ranking features from an explore vendor row."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from app.features.vendors.ranking.types import RankingContext

# Neutral score when a signal is missing (new vendors are not hard-zeroed).
NEUTRAL = 0.5

# Extension points (not weighted in v1 — data not denormalized for ranking):
# - stripe_ready
# - dispute_rate
# - cancellation_rate


def _payload(row: dict[str, Any]) -> dict[str, Any]:
    p = row.get("payload")
    return p if isinstance(p, dict) else {}


def _clamp01(value: float) -> float:
    if value != value:  # NaN
        return NEUTRAL
    return max(0.0, min(1.0, value))


def rating_quality(row: dict[str, Any]) -> float:
    avg = row.get("review_average")
    count = int(row.get("review_count") or 0)
    if avg is None or count <= 0:
        return NEUTRAL
    try:
        rating = float(avg)
    except (TypeError, ValueError):
        return NEUTRAL
    # avg/5 × log1p(count) / log1p(50) — soft-caps volume influence
    volume = math.log1p(count) / math.log1p(50)
    return _clamp01((rating / 5.0) * min(1.0, volume))


def completed_bookings_signal(row: dict[str, Any]) -> float:
    n = int(row.get("completed_bookings") or 0)
    if n <= 0:
        return NEUTRAL
    # Soft saturate around 20 completed bookings
    return _clamp01(math.log1p(n) / math.log1p(20))


def conversion_rate_signal(row: dict[str, Any]) -> float:
    rate = row.get("conversion_rate")
    if rate is None:
        return NEUTRAL
    try:
        return _clamp01(float(rate))
    except (TypeError, ValueError):
        return NEUTRAL


def response_speed(row: dict[str, Any]) -> float:
    seconds = row.get("avg_response_seconds")
    if seconds is None:
        return NEUTRAL
    try:
        s = float(seconds)
    except (TypeError, ValueError):
        return NEUTRAL
    if s <= 0:
        return 1.0
    # Faster is better: 1h → ~0.9, 24h → ~0.5, 72h → ~0.3
    return _clamp01(1.0 / (1.0 + s / 3600.0))


def budget_fit(row: dict[str, Any], ctx: RankingContext) -> float:
    band = ctx.budget_band_gbp
    price = row.get("min_list_price_gbp")
    if price is None:
        payload = _payload(row)
        price = payload.get("min_list_price_gbp")
    if band is None or band <= 0:
        return NEUTRAL
    if price is None:
        return NEUTRAL
    try:
        p = float(price)
    except (TypeError, ValueError):
        return NEUTRAL
    if p <= 0:
        return NEUTRAL
    if p <= band:
        # Prefer using most of the band without going over
        ratio = p / band
        return _clamp01(0.7 + 0.3 * ratio)
    # Over band: degrade smoothly
    over = (p - band) / band
    return _clamp01(0.7 - min(0.7, over * 0.5))


def location_fit(row: dict[str, Any], ctx: RankingContext) -> float:
    target = (ctx.location or "").strip().lower()
    if not target:
        return NEUTRAL
    payload = _payload(row)
    city = str(
        payload.get("baseCity")
        or row.get("base_city_normalized")
        or "",
    ).strip().lower()
    if not city:
        return NEUTRAL
    if city == target or target in city or city in target:
        return 1.0
    related = {r.strip().lower() for r in ctx.related_locations if r and str(r).strip()}
    if city in related or any(r in city or city in r for r in related):
        return 0.75
    return 0.25


def event_experience(row: dict[str, Any], ctx: RankingContext) -> float:
    if not ctx.event_types:
        return NEUTRAL
    payload = _payload(row)
    raw = payload.get("eventTypes")
    if not isinstance(raw, list) or not raw:
        return NEUTRAL
    offered = {str(x).strip().lower() for x in raw if str(x).strip()}
    wanted = {e.strip().lower() for e in ctx.event_types if e and str(e).strip()}
    if not wanted:
        return NEUTRAL
    overlap = len(offered & wanted)
    if overlap <= 0:
        return 0.35
    return _clamp01(0.55 + 0.45 * (overlap / len(wanted)))


def recency(row: dict[str, Any]) -> float:
    raw = row.get("updated_at")
    if not raw:
        return NEUTRAL
    try:
        if isinstance(raw, datetime):
            dt = raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
        else:
            text = str(raw).replace("Z", "+00:00")
            dt = datetime.fromisoformat(text)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return NEUTRAL
    age_days = max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 86400.0)
    # Fresh within ~30 days → high; older decays toward 0.2
    return _clamp01(math.exp(-age_days / 45.0) * 0.8 + 0.2)


def extract_features(row: dict[str, Any], ctx: RankingContext) -> dict[str, float]:
    """Return 0–1 features keyed like RANKING_WEIGHTS."""
    return {
        "rating_quality": rating_quality(row),
        "completed_bookings": completed_bookings_signal(row),
        "conversion_rate": conversion_rate_signal(row),
        "response_speed": response_speed(row),
        "budget_fit": budget_fit(row, ctx),
        "location_fit": location_fit(row, ctx),
        "event_experience": event_experience(row, ctx),
        "recency": recency(row),
    }
