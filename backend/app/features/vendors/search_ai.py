"""Turn plain-language search text into keywords, location, and service filters."""

from __future__ import annotations

import re
import time
from typing import Any

from app.contracts.marketplace_search import MarketplaceQueryParseResult
from app.core.config import get_settings
from app.core.constants import OPENAI_SEARCH_MODEL
from app.core.logging import get_logger
from app.features.vendors.markets import get_market, normalize_country_code
from app.features.vendors.taxonomy import (
    VENDOR_EVENT_TYPE_KEYS,
    VENDOR_SERVICE_KEYS,
    filter_event_type_keys,
    filter_service_keys,
)
from app.features.ai.openai_helpers import extract_json_object, try_openai_client

logger = get_logger(__name__)

_PARSE_CACHE: dict[str, tuple[float, MarketplaceQueryParseResult]] = {}

# Static synonym map when OpenAI is unavailable.
_KEYWORD_TO_TYPE: dict[str, str] = {
    "baker": "baking",
    "bakers": "baking",
    "bakery": "baking",
    "baking": "baking",
    "cake": "baking",
    "cakes": "baking",
    "pastry": "baking",
    "photographer": "photography",
    "photographers": "photography",
    "photography": "photography",
    "photo": "photography",
    "videographer": "photography",
    "makeup": "makeup",
    "mua": "makeup",
    "make-up": "makeup",
    "beautician": "makeup",
    "caterer": "catering",
    "caterers": "catering",
    "catering": "catering",
    "food": "catering",
    "chef": "catering",
    "chops": "catering",
    "rental": "rentals",
    "rentals": "rentals",
    "hire": "rentals",
    "marquee": "rentals",
    "decor": "rentals",
    "décor": "rentals",
}


def _normalize_query(raw_q: str) -> str:
    return re.sub(r"\s+", " ", (raw_q or "").strip().lower())


def _dedupe_strs(items: list[str], *, limit: int) -> list[str]:
    out: list[str] = []
    for item in items:
        word = str(item).strip().lower()
        if word and word not in out:
            out.append(word)
        if len(out) >= limit:
            break
    return out


def _fallback_parse(raw_q: str) -> MarketplaceQueryParseResult:
    """Split the query into words and map synonyms when OpenAI is unavailable."""
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()
    keywords = [w for w in normalized.split() if len(w) >= 2][:16]
    types: list[str] = []
    for kw in keywords:
        mapped = _KEYWORD_TO_TYPE.get(kw)
        if mapped and mapped not in types:
            types.append(mapped)
    related_keywords: list[str] = []
    for kw in keywords:
        if kw.endswith("s") and len(kw) > 3:
            stem = kw[:-1]
            if stem not in keywords and stem not in related_keywords:
                related_keywords.append(stem)
        elif not kw.endswith("s"):
            plural = f"{kw}s"
            if plural not in keywords and plural not in related_keywords:
                related_keywords.append(plural)
    return MarketplaceQueryParseResult(
        keywords=keywords,
        types=filter_service_keys(types),
        related_keywords=related_keywords[:12],
        intent_summary=normalized[:120] or None,
    )


def _sanitize_string_list(raw: Any, *, limit: int) -> list[str]:
    if not isinstance(raw, list):
        return []
    return _dedupe_strs([str(x) for x in raw], limit=limit)


def _sanitize_parse_result(data: dict[str, Any]) -> MarketplaceQueryParseResult:
    keywords = _sanitize_string_list(data.get("keywords"), limit=16)

    location_raw = data.get("location")
    location: str | None = None
    if location_raw is not None:
        loc = str(location_raw).strip()
        if loc:
            location = loc[:120]

    types = filter_service_keys(data.get("types") if isinstance(data.get("types"), list) else [])
    related_types = filter_service_keys(
        data.get("related_types") if isinstance(data.get("related_types"), list) else [],
    )
    # Drop related types that duplicate a primary type.
    related_types = [t for t in related_types if t not in types]

    event_types = filter_event_type_keys(
        data.get("event_types") if isinstance(data.get("event_types"), list) else [],
    )

    related_keywords = _sanitize_string_list(data.get("related_keywords"), limit=16)
    related_keywords = [k for k in related_keywords if k not in keywords]

    related_locations = _sanitize_string_list(data.get("related_locations"), limit=12)
    if location:
        loc_l = location.lower()
        related_locations = [x for x in related_locations if x != loc_l]

    intent_raw = data.get("intent_summary")
    intent_summary: str | None = None
    if intent_raw is not None:
        summary = str(intent_raw).strip()
        if summary:
            intent_summary = summary[:160]

    return MarketplaceQueryParseResult(
        keywords=keywords,
        location=location,
        types=types,
        event_types=event_types,
        related_keywords=related_keywords,
        related_types=related_types,
        related_locations=related_locations,
        intent_summary=intent_summary,
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


def _parse_with_llm(raw_q: str, *, country_code: str) -> MarketplaceQueryParseResult:
    client = try_openai_client()
    if client is None:
        return _fallback_parse(raw_q)

    settings = get_settings()
    model = OPENAI_SEARCH_MODEL
    services = ", ".join(sorted(VENDOR_SERVICE_KEYS))
    events = ", ".join(sorted(VENDOR_EVENT_TYPE_KEYS))
    market = get_market(country_code)

    prompt = (
        f"You parse vendor search queries for Eventtz, an events marketplace in {market.label}. "
        "Extract BOTH exact search intent AND close-enough expansions so we can still show useful vendors. "
        "Respond with a single JSON object ONLY (no markdown):\n"
        "{\n"
        '  "keywords": ["word", "..."],\n'
        '  "related_keywords": ["synonym or stem", "..."],\n'
        f'  "location": "primary city/area in {market.label} or null",\n'
        '  "related_locations": ["nearby city or parent area", "..."],\n'
        '  "types": ["service_key", "..."],\n'
        '  "related_types": ["weaker service_key", "..."],\n'
        '  "event_types": ["event_key", "..."],\n'
        '  "intent_summary": "short phrase for UI, e.g. Caterers in Leeds for small chops"\n'
        "}\n\n"
        f"Allowed service keys (types / related_types): {services}\n"
        f"Allowed event type keys (event_types): {events}\n\n"
        "Rules:\n"
        "- keywords: 1-12 meaningful terms (lowercase). Include cuisine/style (african, halal, "
        "small chops). Omit filler (in, for, my, the, near, someone, selling).\n"
        "- related_keywords: plurals/stems/synonyms that should still match "
        "(baker↔bakers↔baking, photographer↔photography, chops↔finger food↔canapes).\n"
        f"- location: primary city/area in {market.label} if mentioned, else null.\n"
        "- related_locations: nearby towns, boroughs, or parent city (e.g. Croydon → London; "
        "Leeds → Bradford, Wakefield). Do not repeat location.\n"
        "- types: strongest service keys clearly implied "
        "(baker/cake → baking; small chops/food/caterer → catering; photographer → photography).\n"
        "- related_types: weaker but plausible adjacent keys only "
        "(e.g. baking query may relate to catering). Never invent keys outside the allowed list.\n"
        "- event_types: only when clearly implied (wedding → weddings); else [].\n"
        "- intent_summary: one short human phrase, max ~12 words.\n"
        "- Do not invent vendor names.\n\n"
        f"User query: {raw_q.strip()}"
    )

    try:
        resp = client.responses.create(
            model=model,
            input=prompt,
            temperature=0.2,
            max_output_tokens=450,
        )
        raw = (resp.output_text or "").strip()
        if not raw:
            raise ValueError("empty model output")
        parsed = extract_json_object(raw)
        result = _sanitize_parse_result(parsed)
        logger.info(
            "marketplace_search_ai: parsed q=%r keywords=%s related_kw=%s location=%s "
            "related_loc=%s types=%s related_types=%s event_types=%s intent=%r",
            raw_q[:80],
            result.keywords,
            result.related_keywords,
            result.location,
            result.related_locations,
            result.types,
            result.related_types,
            result.event_types,
            result.intent_summary,
        )
        return result
    except Exception as e:
        logger.warning(
            "marketplace_search_ai: LLM parse failed q=%r err=%s — using fallback",
            raw_q[:80],
            e,
        )
        return _fallback_parse(raw_q)


def parse_marketplace_query(
    raw_q: str,
    *,
    country_code: str | None = None,
) -> MarketplaceQueryParseResult:
    """Parse free-text search into keywords, location, and allowed service/event filters."""
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()

    market_country = normalize_country_code(country_code)
    cache_key = f"{market_country}:{normalized}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.debug("marketplace_search_ai: cache hit q=%r country=%s", normalized[:80], market_country)
        return cached

    result = _parse_with_llm(raw_q, country_code=market_country)
    _cache_set(cache_key, result)
    return result


# Exported for unit tests.
sanitize_marketplace_parse_result = _sanitize_parse_result
fallback_parse_marketplace_query = _fallback_parse
