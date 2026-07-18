"""Turn plain-language search text into keywords, location, service filters, and event plans.

``parse_marketplace_query`` decides **simple** vs **plan**:

- **simple** — user wants one kind of vendor (“caterer in Manchester”). Ranking uses
  keywords / types / location as a flat list.
- **plan** — user wants help assembling an event (“plan my birthday”). We return a
  short checklist of needs (each mapped to a service key). Ranking for those needs
  happens in ``search._search_plan_sections``.

Need copy: AI/canned field is ``rationale``; the HTTP section exposes it as ``why``.
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
from app.features.ai.openai_helpers import try_openai_client
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

_PLAN_INTENT_RE = re.compile(
    r"\b("
    r"plan|planning|help\s+me|select\s+vendors|what\s+do\s+i\s+need|"
    r"vendors?\s+for|organise|organize|put\s+together|checklist|"
    r"for\s+my\s+(birthday|wedding|shower|naming)|"
    r"my\s+(birthday|wedding|shower|naming)"
    r")\b",
    re.I,
)

_EVENT_KEYWORD_MAP: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(wedding|weddings|bridal)\b", re.I), "weddings"),
    (re.compile(r"\b(birthday|birthdays)\b", re.I), "birthdays"),
    (re.compile(r"\b(shower|baby\s*shower|bridal\s*shower)\b", re.I), "showers"),
    (re.compile(r"\b(naming|naming\s+ceremon(y|ies)|outdooring)\b", re.I), "naming_ceremonies"),
]

_CANNED_NEEDS: dict[str, list[dict[str, Any]]] = {
    "birthdays": [
        {
            "id": "cake",
            "label": "Birthday cake",
            "service_key": "baking",
            "keywords": ["cake", "birthday cake"],
            "optional": False,
        },
        {
            "id": "food",
            "label": "Food for the party",
            "service_key": "catering",
            "keywords": ["catering", "jollof", "rice", "small chops", "finger food"],
            "optional": False,
        },
        {
            "id": "photos",
            "label": "Photos",
            "service_key": "photography",
            "keywords": ["photography", "photographer"],
            "optional": True,
        },
    ],
    "weddings": [
        {
            "id": "wedding-cake",
            "label": "Wedding cake",
            "service_key": "baking",
            "keywords": ["cake", "wedding cake"],
            "optional": False,
        },
        {
            "id": "food",
            "label": "Food for your guests",
            "service_key": "catering",
            "keywords": ["catering", "jollof", "small chops", "rice"],
            "optional": False,
        },
        {
            "id": "photos",
            "label": "Photos",
            "service_key": "photography",
            "keywords": ["photography", "photographer"],
            "optional": False,
        },
        {
            "id": "makeup",
            "label": "Makeup",
            "service_key": "makeup",
            "keywords": ["makeup", "mua"],
            "optional": True,
        },
        {
            "id": "decor",
            "label": "Decor and hire",
            "service_key": "rentals",
            "keywords": ["rentals", "decor", "hire"],
            "optional": True,
        },
    ],
    "showers": [
        {
            "id": "cake",
            "label": "Cake",
            "service_key": "baking",
            "keywords": ["cake"],
            "optional": False,
        },
        {
            "id": "food",
            "label": "Small chops and bites",
            "service_key": "catering",
            "keywords": ["small chops", "finger food", "catering"],
            "optional": False,
        },
        {
            "id": "photos",
            "label": "Photos",
            "service_key": "photography",
            "keywords": ["photography"],
            "optional": True,
        },
    ],
    "naming_ceremonies": [
        {
            "id": "cake",
            "label": "Celebration cake",
            "service_key": "baking",
            "keywords": ["cake"],
            "optional": False,
        },
        {
            "id": "food",
            "label": "Food for guests",
            "service_key": "catering",
            "keywords": ["catering", "jollof", "rice", "small chops"],
            "optional": False,
        },
        {
            "id": "photos",
            "label": "Photos",
            "service_key": "photography",
            "keywords": ["photography"],
            "optional": True,
        },
    ],
}

_PLAN_TITLES: dict[str, str] = {
    "birthdays": "Ideas for your birthday — cake, food, and more",
    "weddings": "Ideas for your wedding",
    "showers": "Ideas for your shower",
    "naming_ceremonies": "Ideas for your naming ceremony",
}

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
    "jollof": "catering",
    "rice": "catering",
    "rental": "rentals",
    "rentals": "rentals",
    "hire": "rentals",
    "marquee": "rentals",
    "decor": "rentals",
    "décor": "rentals",
}


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


def _detect_event_types(text: str) -> list[str]:
    found: list[str] = []
    for pattern, key in _EVENT_KEYWORD_MAP:
        if pattern.search(text) and key not in found:
            found.append(key)
    return filter_event_type_keys(found)


def _looks_like_plan_query(text: str) -> bool:
    return bool(_PLAN_INTENT_RE.search(text))


def _canned_needs_for_events(event_types: list[str]) -> list[MarketplacePlanNeed]:
    raw_needs: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for et in event_types:
        for item in _CANNED_NEEDS.get(et, []):
            nid = str(item.get("id") or "")
            if not nid or nid in seen_ids:
                continue
            seen_ids.add(nid)
            raw_needs.append({
                **item,
                "rationale": why_for_need(
                    service_key=str(item.get("service_key") or ""),
                    event_types=[et],
                ),
            })
            if len(raw_needs) >= _PLAN_MAX_NEEDS:
                break
        if len(raw_needs) >= _PLAN_MAX_NEEDS:
            break
    return _sanitize_needs(raw_needs, event_types=event_types)


def _plan_title_for_events(event_types: list[str], intent: str | None) -> str | None:
    for et in event_types:
        if et in _PLAN_TITLES:
            return _PLAN_TITLES[et]
    if intent:
        return intent[:160]
    return "Event vendor checklist"


def _friendly_need_label(raw: str, *, service_key: str) -> str:
    """Keep need titles short and client-friendly (no jargon / slash lists)."""
    label = re.sub(r"\s+", " ", (raw or "").strip())
    label = label.replace("/", " and ").replace("&", " and ")
    label = re.sub(r"\s+", " ", label).strip(" -–—")
    # Drop stiff marketplace jargon if the model used the service key as a title.
    stiff = {
        "baking": "Cake",
        "catering": "Food for the party",
        "photography": "Photos",
        "makeup": "Makeup",
        "rentals": "Decor and hire",
    }
    low = label.lower()
    if low in ("photography", "catering", "baking", "rentals", "mua"):
        return stiff.get(service_key, label.title())[:80]
    if "jollof" in low and "rice" in low:
        return "Food for the party"
    if low in ("rice and mains", "rice mains", "rice/jollof mains", "rice and jollof mains"):
        return "Food for the party"
    if not label:
        return stiff.get(service_key, service_key.replace("_", " ").title())[:80]
    return label[:80]


def _slug_id(raw: str, *, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (raw or "").strip().lower()).strip("-")
    return (slug[:48] or fallback)[:64]


_WHY_BY_SERVICE: dict[str, str] = {
    "baking": "A cake is often the centrepiece — compare bakers who do celebration cakes.",
    "catering": "Guests expect proper food — compare caterers for mains and small chops.",
    "photography": "Photos help you keep the day — compare photographers if you want coverage.",
    "makeup": "Many hosts book glam for the day — compare makeup artists if you need it.",
    "rentals": "Decor and hire set the look — compare options if you need tables, chairs, or styling.",
}

_WHY_BY_EVENT_SERVICE: dict[tuple[str, str], str] = {
    ("birthdays", "baking"): "Most birthday hosts book a cake — here are bakers who cover that.",
    ("birthdays", "catering"): "Birthday guests expect good food — jollof, rice, and small chops usually come from a caterer.",
    ("birthdays", "photography"): "Photos help you keep the memories — optional if you already have someone.",
    ("weddings", "baking"): "A wedding cake is a highlight — compare bakers who do celebration cakes.",
    ("weddings", "catering"): "Feeding your guests well matters — compare caterers for the day.",
    ("weddings", "photography"): "Wedding photos are kept for years — compare photographers for your day.",
    ("weddings", "makeup"): "Many couples book glam for the day — skip this if you don’t need it.",
    ("weddings", "rentals"): "Decor and hire shape the room — compare options if you need them.",
    ("showers", "baking"): "A cake makes the shower feel special — compare bakers.",
    ("showers", "catering"): "Light bites and small chops keep guests happy — compare food vendors.",
    ("naming_ceremonies", "baking"): "A celebration cake fits the day — compare bakers.",
    ("naming_ceremonies", "catering"): "Guests will want a proper meal — compare caterers.",
}


def why_for_need(
    *,
    service_key: str,
    event_types: list[str] | None = None,
    rationale: str | None = None,
) -> str:
    """Client-friendly one-liner explaining why this need is in the plan."""
    cleaned = _sanitize_rationale(rationale)
    if cleaned:
        return cleaned
    for et in event_types or []:
        hit = _WHY_BY_EVENT_SERVICE.get((et, service_key))
        if hit:
            return hit
    return _WHY_BY_SERVICE.get(
        service_key,
        "Useful for your event — compare these vendors.",
    )


def _sanitize_rationale(raw: Any) -> str | None:
    if raw is None:
        return None
    text = re.sub(r"\s+", " ", str(raw).strip())
    text = text.replace("/", " and ")
    if not text:
        return None
    # Reject stiff / empty jargon-only blurbs.
    low = text.lower().strip(" .")
    if low in ("photography", "catering", "baking", "rentals", "makeup"):
        return None
    return text[:160]


def _sanitize_needs(
    raw: Any,
    *,
    event_types: list[str] | None = None,
) -> list[MarketplacePlanNeed]:
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
        label = _friendly_need_label(str(data.get("label") or ""), service_key=service_key)
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
        rationale = _sanitize_rationale(data.get("rationale"))
        if not rationale:
            rationale = why_for_need(
                service_key=service_key,
                event_types=event_types,
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
    # Multi-word catering hints
    if "small chops" in normalized or "smallchops" in normalized.replace(" ", ""):
        if "catering" not in types:
            types.append("catering")
        if "chops" not in keywords:
            keywords.append("chops")
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

    event_types = _detect_event_types(normalized)
    mode: Literal["simple", "plan"] = "plan" if _looks_like_plan_query(normalized) else "simple"
    if mode == "simple" and event_types and not types:
        if re.search(r"\b(vendor|vendors|help|need|select|plan)\b", normalized):
            mode = "plan"

    needs: list[MarketplacePlanNeed] = []
    plan_title: str | None = None
    if mode == "plan":
        if not event_types:
            event_types = ["birthdays"]
        needs = _canned_needs_for_events(event_types)
        plan_title = _plan_title_for_events(event_types, normalized[:120])
        if not types:
            types = list(dict.fromkeys(n.service_key for n in needs if not n.optional))

    return MarketplaceQueryParseResult(
        mode=mode,
        keywords=keywords,
        types=filter_service_keys(types),
        related_keywords=related_keywords[:12],
        event_types=event_types,
        intent_summary=normalized[:120] or None,
        plan_title=plan_title,
        needs=needs,
    )


def _sanitize_string_list(raw: Any, *, limit: int) -> list[str]:
    if not isinstance(raw, list):
        return []
    return _dedupe_strs([str(x) for x in raw], limit=limit)


def _sanitize_parse_result(data: dict[str, Any] | MarketplaceQueryParseResult | _LlmMarketplaceParse) -> MarketplaceQueryParseResult:
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

    needs = _sanitize_needs(data.get("needs"), event_types=event_types)
    if mode == "plan" and not needs and event_types:
        needs = _canned_needs_for_events(event_types)
    if mode == "plan" and not needs:
        # Still asked to plan but no event — use birthday staples as a safe default.
        needs = _canned_needs_for_events(["birthdays"])
        if not event_types:
            event_types = ["birthdays"]
    if mode == "plan" and needs:
        # One section per service — avoid repeating the same caterer under rice + chops.
        collapsed: list[MarketplacePlanNeed] = []
        seen_services: set[str] = set()
        for need in needs:
            if need.service_key in seen_services:
                # Merge keywords into the existing need for that service.
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
        needs = collapsed[:_PLAN_MAX_NEEDS]
    if mode == "plan" and not plan_title:
        plan_title = _plan_title_for_events(event_types, intent_summary)
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
        return _fallback_parse(raw_q)

    model = OPENAI_SEARCH_MODEL
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
        "- For birthdays: usually Birthday cake (baking), Food for the party (catering — "
        "covers rice, jollof, small chops in ONE need), and optionally Photos.\n"
        "- For weddings: Wedding cake, Food for your guests, Photos, optionally Makeup, Decor and hire.\n"
        f"- Every need.service_key must be an allowed service key. Max {_PLAN_MAX_NEEDS} needs. "
        "Do NOT split catering into multiple needs (no separate rice vs small chops sections).\n"
        "- need.label must be plain, friendly English a guest would say — short, no slashes, "
        "no jargon (never 'Photography', 'Catering', 'Rice/Jollof Mains'; prefer "
        "'Photos', 'Food for the party', 'Birthday cake').\n"
        "- need.rationale: one short friendly sentence explaining why this need matters for "
        "the event (e.g. 'Most birthday hosts book a cake — here are bakers who cover that.'). "
        "Shown to clients as section.why. No jargon, no vendor names.\n"
        "- plan_title: warm and plain (e.g. 'Ideas for your birthday — cake, food, and more').\n"
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
        try:
            completion = client.chat.completions.parse(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format=_LlmMarketplaceParse,
                temperature=0.2,
            )
        except AttributeError:
            completion = client.beta.chat.completions.parse(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format=_LlmMarketplaceParse,
                temperature=0.2,
            )
        parsed_msg = completion.choices[0].message.parsed
        if parsed_msg is None:
            raise ValueError("empty parsed response")
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
    """
    Parse free-text browse search.

    Returns filters for ranking, plus ``mode`` and optional ``needs`` when the
    query is an event checklist (plan). Cached briefly per country + query.
    """
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()

    market_country = normalize_country_code(country_code)
    cache_key = f"v4:{market_country}:{normalized}"
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
