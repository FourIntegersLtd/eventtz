"""Turning free-text marketplace search into filters and, for event planning, a vendor checklist.

The language model is the only real parser (`mode`, service types, location, plan
needs); this module builds its prompt and clamps its reply to the taxonomy and the
length limits. When the model is unavailable, `token_only_parse` keeps search
working on plain keywords.

- **simple** - one kind of vendor, ranked as one flat list.
- **plan** - an event checklist; each need becomes a section (`domain_search`).

Ported from the baseline `vendors/search_ai.py`; goldens pin the sanitising.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.ports import ChatMessage
from app.features.vendors.service_catalogue import (
    VENDOR_EVENT_TYPE_KEYS,
    VENDOR_SERVICE_KEYS,
    filter_event_type_keys,
    filter_service_keys,
    get_market,
)

SEARCH_MODEL = "gpt-6-luna"
# Keep in sync with `domain_search.PLAN_MAX_NEEDS` and the prompt below.
PLAN_MAX_NEEDS = 6

_GENERIC_WHY = "Useful for your event. Compare these vendors."

# A model "rationale" that only names the service says nothing, so it is dropped.
_BARE_SERVICE_RATIONALES = frozenset(
    {
        "photography",
        "catering",
        "baking",
        "rentals",
        "makeup",
        "decor",
        "dj",
        "mc",
        "hair styling",
        "hair_styling",
        "event planning",
        "event_planning",
    }
)

SearchMode = Literal["simple", "plan"]


class MarketplacePlanNeed(BaseModel):
    """One checklist item in an event-planning search (maps to a marketplace service)."""

    id: str = Field(max_length=64)
    label: str = Field(max_length=80)
    service_key: str = Field(max_length=40)
    keywords: list[str] = Field(default_factory=list, max_length=8)
    optional: bool = False
    # The model's copy; the HTTP section shows the same text as `why`.
    rationale: str | None = Field(default=None, max_length=160)


class MarketplaceQueryParseResult(BaseModel):
    """Keywords and filters extracted from a natural-language vendor search query."""

    mode: SearchMode = "simple"
    keywords: list[str] = Field(default_factory=list, max_length=16)
    location: str | None = Field(default=None, max_length=120)
    types: list[str] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=list)
    # Looser hints: they earn "related" matches, never "exact" ones.
    related_keywords: list[str] = Field(default_factory=list, max_length=16)
    related_types: list[str] = Field(default_factory=list)
    related_locations: list[str] = Field(default_factory=list, max_length=12)
    intent_summary: str | None = Field(default=None, max_length=160)
    plan_title: str | None = Field(default=None, max_length=160)
    needs: list[MarketplacePlanNeed] = Field(default_factory=list, max_length=6)


class ModelPlanNeed(BaseModel):
    """A checklist need as the language model returns it, before sanitising."""

    id: str = Field(default="", max_length=64)
    label: str = Field(default="", max_length=80)
    service_key: str = Field(default="", max_length=40)
    keywords: list[str] = Field(default_factory=list)
    optional: bool = False
    rationale: str | None = None


class ModelQueryParse(BaseModel):
    """The structured reply the language model is asked for."""

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
    needs: list[ModelPlanNeed] = Field(default_factory=list)


def normalize_query(raw_query: str) -> str:
    """The query lower-cased with runs of whitespace collapsed (also the cache key)."""
    return re.sub(r"\s+", " ", (raw_query or "").strip().lower())


def _dedupe_words(items: list[str], *, limit: int) -> list[str]:
    """Stripped, lower-cased, non-blank items in first-seen order, at most `limit`."""
    words: list[str] = []
    for item in items:
        word = str(item).strip().lower()
        if word and word not in words:
            words.append(word)
        if len(words) >= limit:
            break
    return words


def _clip_label(raw_label: str, *, service_key: str) -> str:
    """The need's label, or a title made from its service key when blank."""
    label = re.sub(r"\s+", " ", (raw_label or "").strip())[:80]
    if label:
        return label
    return service_key.replace("_", " ").title()[:80]


def _slug_id(raw_id: str, *, fallback: str) -> str:
    """A URL-safe id for a need (letters, digits and dashes)."""
    slug = re.sub(r"[^a-z0-9]+", "-", (raw_id or "").strip().lower()).strip("-")
    return (slug[:48] or fallback)[:64]


def _sanitize_rationale(raw_rationale: Any) -> str | None:
    """The model's one-sentence reason, or `None` when blank or just a service name."""
    if raw_rationale is None:
        return None
    sentence = re.sub(r"\s+", " ", str(raw_rationale).strip())
    if not sentence:
        return None
    if sentence.lower().strip(" .") in _BARE_SERVICE_RATIONALES:
        return None
    return sentence[:160]


def why_for_need(
    *, service_key: str, event_types: list[str] | None = None, rationale: str | None = None
) -> str:
    """The sentence shown above a plan section: the model's rationale, else a generic line.

    `service_key` and `event_types` are accepted for callers but unused (baseline signature).
    """
    del service_key, event_types
    return _sanitize_rationale(rationale) or _GENERIC_WHY


def _sanitize_needs(raw_needs: Any) -> list[MarketplacePlanNeed]:
    """Checklist needs with a known service, unique ids, clipped labels and at most 8 keywords."""
    if not isinstance(raw_needs, list):
        return []
    needs: list[MarketplacePlanNeed] = []
    seen_ids: set[str] = set()
    for position, item in enumerate(raw_needs):
        if isinstance(item, BaseModel):
            fields = item.model_dump()
        elif isinstance(item, dict):
            fields = item
        else:
            continue
        service_keys = filter_service_keys([str(fields.get("service_key") or "")])
        if not service_keys:
            continue
        service_key = service_keys[0]
        label = _clip_label(str(fields.get("label") or ""), service_key=service_key)
        need_id = _slug_id(str(fields.get("id") or label), fallback=f"need-{position + 1}")
        if need_id in seen_ids:
            need_id = f"{need_id}-{position + 1}"
        seen_ids.add(need_id)
        keywords = _dedupe_words(
            [str(keyword) for keyword in (fields.get("keywords") or []) if str(keyword).strip()], limit=8
        )
        needs.append(
            MarketplacePlanNeed(
                id=need_id,
                label=label,
                service_key=service_key,
                keywords=keywords or [service_key],
                optional=bool(fields.get("optional")),
                rationale=_sanitize_rationale(fields.get("rationale"))
                or why_for_need(service_key=service_key),
            )
        )
        if len(needs) >= PLAN_MAX_NEEDS:
            break
    return needs


def token_only_parse(raw_query: str) -> MarketplaceQueryParseResult:
    """The fallback when the model is unavailable: keywords only, no types, events or plan."""
    normalized = normalize_query(raw_query)
    if not normalized:
        return MarketplaceQueryParseResult()
    keywords = [word for word in normalized.split() if len(word) >= 2][:16]
    return MarketplaceQueryParseResult(
        mode="simple", keywords=keywords, intent_summary=normalized[:120] or None
    )


def _string_list(raw_items: Any, *, limit: int) -> list[str]:
    """A deduplicated, lower-cased list of at most `limit` strings; anything else is empty."""
    if not isinstance(raw_items, list):
        return []
    return _dedupe_words([str(item) for item in raw_items], limit=limit)


def _collapse_needs_by_service(needs: list[MarketplacePlanNeed]) -> list[MarketplacePlanNeed]:
    """One need per service: a repeat's keywords merge into the first need for that service."""
    collapsed: list[MarketplacePlanNeed] = []
    seen_services: set[str] = set()
    for need in needs:
        if need.service_key in seen_services:
            for existing in collapsed:
                if existing.service_key == need.service_key:
                    merged_keywords = list(existing.keywords)
                    for keyword in need.keywords:
                        if keyword not in merged_keywords:
                            merged_keywords.append(keyword)
                    existing.keywords = merged_keywords[:8]
                    break
            continue
        seen_services.add(need.service_key)
        collapsed.append(need)
    return collapsed[:PLAN_MAX_NEEDS]


def _clipped_text(raw_text: Any, *, limit: int) -> str | None:
    """Stripped text cut to `limit` characters, or `None` when missing or blank."""
    if raw_text is None:
        return None
    stripped = str(raw_text).strip()
    return stripped[:limit] if stripped else None


def _key_list(raw_items: Any) -> list[str]:
    """The value when it is a list, else empty (for the taxonomy filters)."""
    return raw_items if isinstance(raw_items, list) else []


def sanitize_parse_result(
    reply: dict[str, Any] | MarketplaceQueryParseResult | ModelQueryParse,
) -> MarketplaceQueryParseResult:
    """Clamp a model reply to the taxonomy and limits, and settle simple versus plan mode.

    Simple mode drops the checklist; plan mode without explicit types takes them
    from the non-optional needs (at most five).
    """
    fields = reply.model_dump() if isinstance(reply, BaseModel) else reply

    keywords = _string_list(fields.get("keywords"), limit=16)
    location = _clipped_text(fields.get("location"), limit=120)

    types = filter_service_keys(_key_list(fields.get("types")))
    related_types = [
        key for key in filter_service_keys(_key_list(fields.get("related_types"))) if key not in types
    ]
    event_types = filter_event_type_keys(_key_list(fields.get("event_types")))

    related_keywords = [
        word for word in _string_list(fields.get("related_keywords"), limit=16) if word not in keywords
    ]
    related_locations = _string_list(fields.get("related_locations"), limit=12)
    if location:
        related_locations = [place for place in related_locations if place != location.lower()]

    intent_summary = _clipped_text(fields.get("intent_summary"), limit=160)
    plan_title = _clipped_text(fields.get("plan_title"), limit=160)

    mode: SearchMode = "plan" if str(fields.get("mode") or "simple").strip().lower() == "plan" else "simple"
    needs = _sanitize_needs(fields.get("needs"))
    if mode == "plan" and needs:
        needs = _collapse_needs_by_service(needs)
    if mode == "simple":
        needs = []
        plan_title = None
    elif needs and not types:
        types = list(dict.fromkeys(need.service_key for need in needs if not need.optional))[:5]

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


def parse_messages(raw_query: str, *, country_code: str) -> list[ChatMessage]:
    """The system and user prompt for parsing one query (verbatim from the baseline)."""
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
        "- For weddings: Wedding cake, Food for your guests, Photos, optionally Makeup, Hair, "
        "Decor, Rentals, DJ, MC, and Event planner.\n"
        f"- Every need.service_key must be an allowed service key. Max {PLAN_MAX_NEEDS} needs. "
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
        f"User query: {raw_query.strip()}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
