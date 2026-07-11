"""LLM parsing of natural-language marketplace search queries."""

from __future__ import annotations

import re
import time
from typing import Any

from app.contracts.marketplace_search import MarketplaceQueryParseResult
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.vendor_taxonomy import (
    VENDOR_EVENT_TYPE_KEYS,
    VENDOR_SERVICE_KEYS,
    filter_event_type_keys,
    filter_service_keys,
)
from app.features.ai.openai_helpers import extract_json_object, try_openai_client

logger = get_logger(__name__)

_PARSE_CACHE: dict[str, tuple[float, MarketplaceQueryParseResult]] = {}


def _normalize_query(raw_q: str) -> str:
    return re.sub(r"\s+", " ", (raw_q or "").strip().lower())


def _fallback_parse(raw_q: str) -> MarketplaceQueryParseResult:
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()
    keywords = [w for w in normalized.split() if len(w) >= 2][:16]
    return MarketplaceQueryParseResult(keywords=keywords)


def _sanitize_parse_result(data: dict[str, Any]) -> MarketplaceQueryParseResult:
    keywords_raw = data.get("keywords")
    keywords: list[str] = []
    if isinstance(keywords_raw, list):
        for item in keywords_raw:
            word = str(item).strip().lower()
            if word and word not in keywords:
                keywords.append(word)
            if len(keywords) >= 16:
                break

    location_raw = data.get("location")
    location: str | None = None
    if location_raw is not None:
        loc = str(location_raw).strip()
        if loc:
            location = loc[:120]

    types = filter_service_keys(data.get("types") if isinstance(data.get("types"), list) else [])
    event_types = filter_event_type_keys(
        data.get("event_types") if isinstance(data.get("event_types"), list) else [],
    )

    return MarketplaceQueryParseResult(
        keywords=keywords,
        location=location,
        types=types,
        event_types=event_types,
    )


def _cache_get(key: str) -> MarketplaceQueryParseResult | None:
    settings = get_settings()
    ttl = max(0, int(settings.marketplace_search_ai_cache_ttl_seconds))
    entry = _PARSE_CACHE.get(key)
    if not entry:
        return None
    expires_at, result = entry
    if ttl <= 0 or time.monotonic() > expires_at:
        _PARSE_CACHE.pop(key, None)
        return None
    return result


def _cache_set(key: str, result: MarketplaceQueryParseResult) -> None:
    settings = get_settings()
    ttl = max(0, int(settings.marketplace_search_ai_cache_ttl_seconds))
    if ttl <= 0:
        return
    max_entries = max(1, int(settings.marketplace_search_ai_cache_max_entries))
    if len(_PARSE_CACHE) >= max_entries:
        oldest_key = min(_PARSE_CACHE, key=lambda k: _PARSE_CACHE[k][0])
        _PARSE_CACHE.pop(oldest_key, None)
    _PARSE_CACHE[key] = (time.monotonic() + ttl, result)


def _parse_with_llm(raw_q: str) -> MarketplaceQueryParseResult:
    client = try_openai_client()
    if client is None:
        return _fallback_parse(raw_q)

    settings = get_settings()
    model = (settings.openai_search_model or "gpt-4o-mini").strip() or "gpt-4o-mini"
    services = ", ".join(sorted(VENDOR_SERVICE_KEYS))
    events = ", ".join(sorted(VENDOR_EVENT_TYPE_KEYS))

    prompt = (
        "You parse vendor search queries for Eventtz, a UK events marketplace for African vendors. "
        "Extract structured search signals from the user's text. "
        "Respond with a single JSON object ONLY (no markdown):\n"
        '{"keywords": ["word", "..."], "location": "city or area or null", '
        '"types": ["service_key", "..."], "event_types": ["event_key", "..."]}\n\n'
        f"Allowed service keys (types): {services}\n"
        f"Allowed event type keys (event_types): {events}\n\n"
        "Rules:\n"
        "- keywords: 1-12 meaningful search terms (lowercase); include cuisine/style words "
        "(e.g. african, halal) but NOT generic filler (in, for, my, the, near).\n"
        "- location: UK city/area if mentioned, else null.\n"
        "- types: only when clearly implied (e.g. photographer → photography); else [].\n"
        "- event_types: only when clearly implied (e.g. wedding → weddings); else [].\n"
        "- Do not invent vendor names.\n\n"
        f"User query: {raw_q.strip()}"
    )

    try:
        resp = client.responses.create(
            model=model,
            input=prompt,
            temperature=0.2,
            max_output_tokens=300,
        )
        raw = (resp.output_text or "").strip()
        if not raw:
            raise ValueError("empty model output")
        parsed = extract_json_object(raw)
        result = _sanitize_parse_result(parsed)
        logger.info(
            "marketplace_search_ai: parsed q=%r keywords=%s location=%s types=%s event_types=%s",
            raw_q[:80],
            result.keywords,
            result.location,
            result.types,
            result.event_types,
        )
        return result
    except Exception as e:
        logger.warning(
            "marketplace_search_ai: LLM parse failed q=%r err=%s — using fallback",
            raw_q[:80],
            e,
        )
        return _fallback_parse(raw_q)


def parse_marketplace_query(raw_q: str) -> MarketplaceQueryParseResult:
    """Parse free-text search into keywords, location, and taxonomy filters."""
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()

    cached = _cache_get(normalized)
    if cached is not None:
        logger.debug("marketplace_search_ai: cache hit q=%r", normalized[:80])
        return cached

    result = _parse_with_llm(raw_q)
    _cache_set(normalized, result)
    return result
