"""Turn plain-language search text into keywords, location, service filters, and event plans.

The **LLM** is the only query parser (``mode``, types, location, plan needs).
Sanitize only clamps taxonomy, length, and duplicate catering needs.

- **simple** - one kind of vendor. Ranking uses keywords / types / location as a flat list.
- **plan** - event checklist. Ranking is ``search._search_plan_sections``.

``need.rationale`` is shown on the HTTP section as ``why``.
"""

from __future__ import annotations

import re
import time
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.contracts.marketplace_search import MarketplacePlanNeed, MarketplaceQueryParseResult
from app.core.config import get_settings
from app.core.constants import OPENAI_SEARCH_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, try_openai_client
from app.features.vendors.markets import get_market, normalize_country_code
from app.features.vendors.taxonomy import (
    VENDOR_EVENT_TYPE_KEYS,
    VENDOR_SERVICE_KEYS,
    filter_event_type_keys,
    filter_service_keys,
)

logger = get_logger(__name__)

# Keep in sync with ``search._PLAN_MAX_NEEDS`` and the LLM prompt below.
_PLAN_MAX_NEEDS = 6

_PARSE_CACHE: dict[str, tuple[float, MarketplaceQueryParseResult]] = {}

_GENERIC_WHY = "Useful for your event. Compare these vendors."


class _LlmPlanNeed(BaseModel):
    id: str = Field(default="", max_length=64)
    label: str = Field(default="", max_length=80)
    service_key: str = Field(default="", max_length=40)
    keywords: list[str] = Field(default_factory=list)
    optional: bool = False
    rationale: str | None = None


class _LlmMarketplaceParse(BaseModel):
    mode: Literal["simple", "plan"] = "simple"
    keywords: list[str] = Field(default_factory=list)
    related_keywords: list[str] = Field(default_factory=list)
    location: str | None = None
    related_locations: list[str] = Field(default_factory=list)
    types: list[str] = Field(default_factory=list)
    related_types: list[str] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=list)
    intent_summary: str | None = None
    plan_title: str | None = None
    needs: list[_LlmPlanNeed] = Field(default_factory=list)


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


def _clip_label(raw: str, *, service_key: str) -> str:
    label = re.sub(r"\s+", " ", (raw or "").strip())[:80]
    if label:
        return label
    return service_key.replace("_", " ").title()[:80]


def _slug_id(raw: str, *, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (raw or "").strip().lower()).strip("-")
    return (slug[:48] or fallback)[:64]


def _sanitize_rationale(raw: Any) -> str | None:
    if raw is None:
        return None
    text = re.sub(r"\s+", " ", str(raw).strip())
    if not text:
        return None
    low = text.lower().strip(" .")
    if low in ("photography", "catering", "baking", "rentals", "makeup"):
        return None
    return text[:160]


def why_for_need(
    *,
    service_key: str,
    event_types: list[str] | None = None,
    rationale: str | None = None,
) -> str:
    """Prefer the LLM rationale; otherwise a generic compare line."""
    del service_key, event_types
    cleaned = _sanitize_rationale(rationale)
    return cleaned or _GENERIC_WHY


def _sanitize_needs(raw: Any) -> list[MarketplacePlanNeed]:
    if not isinstance(raw, list):
        return []
    out: list[MarketplacePlanNeed] = []
    seen: set[str] = set()
    for i, item in enumerate(raw):
        if isinstance(item, MarketplacePlanNeed):
            data = item.model_dump()
        elif isinstance(item, BaseModel):
            data = item.model_dump()
        elif isinstance(item, dict):
            data = item
        else:
            continue
        service_keys = filter_service_keys([str(data.get("service_key") or "")])
        if not service_keys:
            continue
        service_key = service_keys[0]
        label = _clip_label(str(data.get("label") or ""), service_key=service_key)
        need_id = _slug_id(str(data.get("id") or label), fallback=f"need-{i+1}")
        if need_id in seen:
            need_id = f"{need_id}-{i+1}"
        seen.add(need_id)
        keywords = _dedupe_strs(
            [str(x) for x in (data.get("keywords") or []) if str(x).strip()],
            limit=8,
        )
        if not keywords:
            keywords = [service_key]
        rationale = _sanitize_rationale(data.get("rationale")) or why_for_need(
            service_key=service_key,
            rationale=None,
        )
        out.append(
            MarketplacePlanNeed(
                id=need_id,
                label=label,
                service_key=service_key,
                keywords=keywords,
                optional=bool(data.get("optional")),
                rationale=rationale,
            ),
        )
        if len(out) >= _PLAN_MAX_NEEDS:
            break
    return out


def _token_only_parse(raw_q: str) -> MarketplaceQueryParseResult:
    """OpenAI down: keywords only. No types, events, or plan needs."""
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()
    keywords = [w for w in normalized.split() if len(w) >= 2][:16]
    return MarketplaceQueryParseResult(
        mode="simple",
        keywords=keywords,
        intent_summary=normalized[:120] or None,
    )


def _sanitize_string_list(raw: Any, *, limit: int) -> list[str]:
    if not isinstance(raw, list):
        return []
    return _dedupe_strs([str(x) for x in raw], limit=limit)


def _collapse_needs_by_service(needs: list[MarketplacePlanNeed]) -> list[MarketplacePlanNeed]:
    collapsed: list[MarketplacePlanNeed] = []
    seen_services: set[str] = set()
    for need in needs:
        if need.service_key in seen_services:
            for existing in collapsed:
                if existing.service_key == need.service_key:
                    merged_kw = list(existing.keywords)
                    for kw in need.keywords:
                        if kw not in merged_kw:
                            merged_kw.append(kw)
                    existing.keywords = merged_kw[:8]
                    break
            continue
        seen_services.add(need.service_key)
        collapsed.append(need)
    return collapsed[:_PLAN_MAX_NEEDS]


def _sanitize_parse_result(
    data: dict[str, Any] | MarketplaceQueryParseResult | _LlmMarketplaceParse,
) -> MarketplaceQueryParseResult:
    if isinstance(data, MarketplaceQueryParseResult):
        data = data.model_dump()
    elif isinstance(data, _LlmMarketplaceParse):
        data = data.model_dump()

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

    plan_title_raw = data.get("plan_title")
    plan_title: str | None = None
    if plan_title_raw is not None:
        title = str(plan_title_raw).strip()
        if title:
            plan_title = title[:160]

    mode_raw = str(data.get("mode") or "simple").strip().lower()
    mode: Literal["simple", "plan"] = "plan" if mode_raw == "plan" else "simple"

    needs = _sanitize_needs(data.get("needs"))
    if mode == "plan" and needs:
        needs = _collapse_needs_by_service(needs)
    if mode == "simple":
        needs = []
        plan_title = None
    elif needs and not types:
        types = list(dict.fromkeys(n.service_key for n in needs if not n.optional))[:5]

    return MarketplaceQueryParseResult(
        mode=mode,
        keywords=keywords,
        location=location,
        types=types,
        event_types=event_types,
        related_keywords=related_keywords,
        related_types=related_types,
        related_locations=related_locations,
        intent_summary=intent_summary,
        plan_title=plan_title,
        needs=needs,
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
        return _token_only_parse(raw_q)

    services = ", ".join(sorted(VENDOR_SERVICE_KEYS))
    events = ", ".join(sorted(VENDOR_EVENT_TYPE_KEYS))
    market = get_market(country_code)

    system = (
        f"You parse vendor search queries for Eventtz, an events marketplace in {market.label} "
        "focused on African and diaspora celebrations. "
        "Extract search filters AND, when the user is planning an event, a short vendor checklist. "
        f"Allowed service keys: {services}. "
        f"Allowed event type keys: {events}."
    )
    user = (
        "Return structured fields for this query.\n\n"
        "Rules:\n"
        "- mode=plan when the user asks to plan / select vendors / what they need for an event "
        "(birthday, wedding, shower, naming). mode=simple for a single vendor hunt "
        "(e.g. 'caterer in Manchester', 'puff-puff in Leeds').\n"
        "- For birthdays: usually Birthday cake (baking), Food for the party (catering - "
        "covers rice, jollof, small chops in ONE need), and optionally Photos.\n"
        "- For weddings: Wedding cake, Food for your guests, Photos, optionally Makeup, Decor and hire.\n"
        f"- Every need.service_key must be an allowed service key. Max {_PLAN_MAX_NEEDS} needs. "
        "Do NOT split catering into multiple needs (no separate rice vs small chops sections).\n"
        "- need.label must be plain, friendly English a guest would say - short, no slashes, "
        "no jargon (never 'Photography', 'Catering', 'Rice/Jollof Mains'; prefer "
        "'Photos', 'Food for the party', 'Birthday cake').\n"
        "- need.rationale: one short friendly sentence explaining why this need matters for "
        "the event (e.g. 'Most birthday hosts book a cake. Here are bakers who cover that.'). "
        "Shown to clients as section.why. No jargon, no vendor names.\n"
        "- plan_title: warm and plain (e.g. 'Ideas for your birthday - cake, food, and more').\n"
        "- keywords: 1-12 meaningful terms. related_keywords: stems/synonyms.\n"
        f"- location: primary city/area in {market.label} or null; "
        "related_locations nearby areas.\n"
        "- types / related_types: allowed service keys only.\n"
        "- event_types: only when clearly implied.\n"
        "- intent_summary: short human phrase (~12 words).\n"
        "- Do not invent vendor names.\n\n"
        f"User query: {raw_q.strip()}"
    )
    try:
        parsed_msg = parse_completion(
            client=client,
            model=OPENAI_SEARCH_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format=_LlmMarketplaceParse,
            log_context="marketplace_search_ai",
        )
        result = _sanitize_parse_result(parsed_msg)
        logger.info(
            "marketplace_search_ai: parsed q=%r mode=%s keywords=%s types=%s "
            "event_types=%s needs=%s intent=%r",
            raw_q[:80],
            result.mode,
            result.keywords,
            result.types,
            result.event_types,
            [n.id for n in result.needs],
            result.intent_summary,
        )
        return result
    except Exception as e:
        logger.warning(
            "marketplace_search_ai: LLM parse failed q=%r err=%s - using keywords only",
            raw_q[:80],
            e,
        )
        return _token_only_parse(raw_q)


def parse_marketplace_query(
    raw_q: str,
    *,
    country_code: str | None = None,
) -> MarketplaceQueryParseResult:
    """
    Parse free-text browse search via the LLM.

    Returns filters for ranking, plus ``mode`` and optional ``needs`` when the
    query is an event checklist (plan). Cached briefly per country + query.
    """
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()

    market_country = normalize_country_code(country_code)
    cache_key = f"v5:{market_country}:{normalized}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.debug("marketplace_search_ai: cache hit q=%r country=%s", normalized[:80], market_country)
        return cached

    result = _parse_with_llm(raw_q, country_code=market_country)
    _cache_set(cache_key, result)
    return result


# Exported for unit tests.
sanitize_marketplace_parse_result = _sanitize_parse_result
token_only_marketplace_parse = _token_only_parse
