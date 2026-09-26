"""Pure ranking for marketplace search: tiers, scores, sort orders and the plan-mode sections.

Two browse modes come out of a parsed query (`domain_query`):

- **simple**: one ranked list, exact matches, then related, then a fallback.
- **plan**: a short checklist of needs (cake, food, photos…), each a section of
  vendors. A vendor appears once; the first need that matches them keeps them.

Ported from the baseline `vendors/search.py`. Vendors travel as plain dicts
because the response adds fields per mode (`match_tier`, `match_hint`, …).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

from app.features.marketplace.domain_metrics import FeaturedReview, VendorSignals
from app.features.marketplace.domain_query import (
    PLAN_MAX_NEEDS,
    MarketplacePlanNeed,
    MarketplaceQueryParseResult,
    why_for_need,
)
from app.features.vendors.schemas import ListedVendor
from app.features.vendors.service_catalogue import filter_service_keys, min_listing_price_gbp

SortKey = Literal["relevance", "price_asc", "price_desc", "proximity", "rating"]
SORT_KEYS: tuple[str, ...] = ("relevance", "price_asc", "price_desc", "proximity", "rating")

_TIER_RANK = {"exact": 0, "related": 1, "fallback": 2}
# Cards per plan section, so the page stays scannable.
PLAN_SECTION_VENDOR_LIMIT = 8
# Rank more candidates than a section shows, so earlier sections don't empty later ones.
_PLAN_RANK_POOL_MULTIPLIER = 4
_PLAN_RANK_POOL_MIN = 24
# The most search results one page may ask for.
MAX_PAGE_SIZE = 200
# Event dates a search may filter on.
MAX_SEARCH_DATES = 3
# Raw query words used as keywords when the parse found none.
MAX_RAW_KEYWORDS = 16

_MATCH_HINT_BY_SERVICE: dict[str, str] = {
    "baking": "Offers cakes and baking",
    "catering": "Offers catering",
    "photography": "Offers photography",
    "makeup": "Offers makeup",
    "rentals": "Offers furniture and hire",
    "event_planning": "Offers event planning",
    "decor": "Offers decor and styling",
    "dj": "Offers DJ and music",
    "mc": "Offers MC and hosting",
    "hair_styling": "Offers hair styling",
}

# Words that make a review quote fit the section the vendor was placed under.
REVIEW_PREFER_TERMS: dict[str, list[str]] = {
    "baking": ["cake", "baker", "baking", "cupcake", "dessert", "icing"],
    "catering": ["food", "cater", "jollof", "chops", "meal", "rice", "buffet"],
    "photography": ["photo", "picture", "shot", "album", "camera"],
    "makeup": ["makeup", "glam", "mua", "bridal"],
    "rentals": ["hire", "rental", "table", "chair", "marquee", "furniture"],
    "event_planning": ["planner", "planning", "coordination", "timeline", "organise"],
    "decor": ["decor", "balloon", "floral", "backdrop", "styling", "tablescape"],
    "dj": ["dj", "music", "dancefloor", "band", "sound"],
    "mc": ["mc", "host", "alaga", "emcee", "announce"],
    "hair_styling": ["hair", "braids", "stylist", "weave", "wig", "bridal hair"],
}


@dataclass
class SearchSection:
    """One plan need and the vendors placed under it."""

    need_id: str
    label: str
    service_key: str
    optional: bool = False
    vendors: list[dict[str, Any]] = field(default_factory=list)
    # How many unclaimed vendors matched before the section was cut to its card limit.
    total_count: int = 0
    # The client-facing sentence on why this need matters.
    why: str | None = None


@dataclass
class SearchPlan:
    """The checklist a plan-mode search built."""

    title: str
    event_types: list[str] = field(default_factory=list)
    needs: list[MarketplacePlanNeed] = field(default_factory=list)
    intent_summary: str | None = None


@dataclass
class SearchResult:
    """What a search returns: the vendors (one page in simple mode) and how well they matched."""

    vendors: list[dict[str, Any]] = field(default_factory=list)
    match_notice: str | None = None
    has_exact: bool = False
    has_related: bool = False
    total_count: int = 0
    search_mode: Literal["simple", "plan"] = "simple"
    intent_summary: str | None = None
    plan: SearchPlan | None = None
    sections: list[SearchSection] = field(default_factory=list)


@dataclass(frozen=True)
class SearchFilters:
    """Everything ranking needs from the request and the parsed query."""

    primary_types: list[str]
    related_types: list[str]
    keywords: list[str]
    related_keywords: list[str]
    location_filter: str
    related_locations: list[str]
    parsed_event_types: list[str]
    date_parts: list[str]
    apply_date_availability: bool
    budget_min: float | None
    budget_max: float | None
    sort_key: str
    intent_summary: str | None


# --- request parameters ---------------------------------------------------------------------------


def parse_types_param(types: str | None) -> list[str]:
    """Known service keys from the comma-separated `types` chip parameter."""
    if not types or not types.strip():
        return []
    return filter_service_keys([part.strip() for part in types.split(",") if part.strip()])


def parse_dates_param(dates: str | None) -> list[str]:
    """The first three comma-separated event dates, as sent."""
    if not dates or not dates.strip():
        return []
    return [part.strip() for part in dates.split(",") if part.strip()][:MAX_SEARCH_DATES]


def normalize_sort(sort: str | None) -> str:
    """A known sort key, falling back to relevance."""
    sort_key = sort.strip().lower() if sort else "relevance"
    return sort_key if sort_key in SORT_KEYS else "relevance"


def search_filters(
    *,
    chip_types: list[str],
    parsed: MarketplaceQueryParseResult | None,
    raw_query: str,
    location: str | None,
    date_parts: list[str],
    flexible: bool,
    budget_min: float | None,
    budget_max: float | None,
    sort: str | None,
) -> SearchFilters:
    """Combine the URL filters with what the parse understood.

    Chips win over parsed service types; in plan mode parsed types are left to the needs.
    """
    plan_mode = is_plan_search(parsed)
    primary_types = list(chip_types)
    if not primary_types and parsed and parsed.types and not plan_mode:
        primary_types = list(parsed.types)
    related_types = [key for key in (parsed.related_types if parsed else []) if key not in primary_types]

    location_filter = (location or "").strip()
    if not location_filter and parsed and parsed.location:
        location_filter = parsed.location.strip()

    keywords = list(parsed.keywords) if parsed else []
    if not keywords and raw_query:
        keywords = [word for word in raw_query.lower().split() if len(word) >= 2][:MAX_RAW_KEYWORDS]

    return SearchFilters(
        primary_types=primary_types,
        related_types=related_types,
        keywords=keywords,
        related_keywords=list(parsed.related_keywords) if parsed else [],
        location_filter=location_filter,
        related_locations=list(parsed.related_locations) if parsed else [],
        parsed_event_types=list(parsed.event_types) if parsed else [],
        date_parts=date_parts,
        apply_date_availability=bool(date_parts) and not flexible,
        budget_min=budget_min,
        budget_max=budget_max,
        sort_key=normalize_sort(sort),
        intent_summary=parsed.intent_summary if parsed else None,
    )


def is_plan_search(parsed: MarketplaceQueryParseResult | None) -> bool:
    """True when the parse asked for a checklist of needs."""
    return bool(parsed and parsed.mode == "plan" and parsed.needs)


def plan_needs(parsed: MarketplaceQueryParseResult, chip_types: list[str]) -> list[MarketplacePlanNeed]:
    """The needs to show: those matching the selected chips, or all when none match."""
    needs = list(parsed.needs)
    if chip_types:
        needs = [need for need in needs if need.service_key in chip_types] or needs
    return needs


# --- vendor availability --------------------------------------------------------------------------


def _normalize_iso_date(raw_date: str) -> str | None:
    """`YYYY-MM-DD` from the start of an ISO date or timestamp, or `None` when it is not a date."""
    candidate = raw_date.strip()
    if len(candidate) >= 10:
        candidate = candidate[:10]
    try:
        date.fromisoformat(candidate)
    except ValueError:
        return None
    return candidate


def _blocked_dates(payload: dict[str, Any]) -> set[str]:
    """The days the vendor marked unavailable during onboarding."""
    raw_dates = payload.get("blockedDates")
    if not isinstance(raw_dates, list):
        return set()
    blocked: set[str] = set()
    for raw_date in raw_dates:
        if isinstance(raw_date, str) and (iso_date := _normalize_iso_date(raw_date)):
            blocked.add(iso_date)
    return blocked


def _available_weekdays(payload: dict[str, Any]) -> set[int]:
    """The weekdays the vendor works, as in onboarding: 0 = Monday … 6 = Sunday."""
    raw_days = payload.get("availableWeekdays")
    if not isinstance(raw_days, list):
        return set()
    weekdays: set[int] = set()
    for raw_day in raw_days:
        if isinstance(raw_day, bool) or not isinstance(raw_day, int | float):
            continue
        weekday = int(raw_day)
        if 0 <= weekday <= 6:
            weekdays.add(weekday)
    return weekdays


def vendor_available_on(payload: dict[str, Any], event_dates: list[str]) -> bool:
    """True unless one of the dates is blocked or falls on a day the vendor does not work.

    Profiles with no working weekdays (older ones) skip the weekday check; blocked
    dates still apply. Dates that are not dates are ignored.
    """
    if not event_dates:
        return True
    blocked = _blocked_dates(payload)
    weekdays = _available_weekdays(payload)
    for raw_date in event_dates:
        iso_date = _normalize_iso_date(raw_date)
        if iso_date is None:
            continue
        if iso_date in blocked:
            return False
        if weekdays and date.fromisoformat(iso_date).weekday() not in weekdays:
            return False
    return True


# --- scoring --------------------------------------------------------------------------------------


def _services_offered(payload: dict[str, Any]) -> list[str]:
    """The known service keys the vendor offers."""
    raw_services = payload.get("servicesOffered")
    if not isinstance(raw_services, list):
        return []
    return filter_service_keys([str(service) for service in raw_services if str(service).strip()])


def _event_types_offered(payload: dict[str, Any]) -> list[str]:
    """The event types the vendor says they cover, as stored."""
    raw_types = payload.get("eventTypes")
    if not isinstance(raw_types, list):
        return []
    return [str(event_type).strip() for event_type in raw_types if str(event_type).strip()]


def _haystack(vendor: ListedVendor) -> str:
    """The lower-cased text keywords are matched against."""
    payload = vendor.payload
    return " ".join(
        [
            str(payload.get("baseCity") or ""),
            str(payload.get("businessName") or ""),
            " ".join(_services_offered(payload)),
            " ".join(_event_types_offered(payload)),
            str(payload.get("aiBioDraft") or ""),
            str(vendor.email or ""),
        ]
    ).lower()


def _keyword_hits(haystack: str, keywords: list[str]) -> int:
    """How many keywords appear anywhere in the haystack."""
    return sum(1 for keyword in keywords if keyword and keyword in haystack)


def _overlaps(first: str, second: str) -> bool:
    """True when either lower-cased place name contains the other."""
    return bool(first and second and (first in second or second in first))


def _location_bonus(location: str, base_city: str, related_locations: list[str]) -> float:
    """2 for the searched place, 1 for a nearby one, else 0."""
    city = base_city.strip().lower()
    if _overlaps(location.strip().lower(), city):
        return 2.0
    if any(_overlaps(related.strip().lower(), city) for related in related_locations):
        return 1.0
    return 0.0


def _passes_budget(
    payload: dict[str, Any], *, budget_min: float | None, budget_max: float | None
) -> tuple[bool, float | None]:
    """Whether the vendor's lowest list price is inside the budget, and that price.

    A vendor with no list price always passes.
    """
    min_price = min_listing_price_gbp(payload)
    if budget_min is not None and min_price is not None and min_price < budget_min:
        return False, min_price
    if budget_max is not None and min_price is not None and min_price > budget_max:
        return False, min_price
    return True, min_price


def _updated_timestamp(updated_at: str | None) -> float:
    """The row's last update as epoch seconds, 0 when missing or unreadable."""
    if not updated_at:
        return 0.0
    try:
        return datetime.fromisoformat(updated_at.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def match_notice(
    *,
    has_exact: bool,
    has_related: bool,
    has_fallback: bool,
    intent_summary: str | None,
    date_softened: bool,
) -> str | None:
    """The banner shown when nothing matched exactly (the web shows its own divider otherwise)."""
    base = (intent_summary or "").strip()
    if has_exact:
        return None
    if has_related:
        bits = ["No exact matches - showing close options"]
        if base:
            bits.append(f"for {base}")
        if date_softened:
            bits.append("(including vendors not free on your selected dates)")
        return " ".join(bits)
    if has_fallback:
        bits = ["No close matches - showing similar vendors"]
        if base:
            bits.append(f"related to {base}")
        return " ".join(bits)
    return None


def _sort_key(sort_key: str) -> Any:
    """The ordering for one sort option; tier always comes first."""

    def ordering(vendor: dict[str, Any]) -> tuple[Any, ...]:
        """Sort tuple for one ranked vendor."""
        tier = _TIER_RANK.get(str(vendor.get("match_tier") or "exact"), 0)
        min_price = vendor.get("_min_price")
        timestamp = float(vendor.get("_ts") or 0)
        if sort_key == "price_asc":
            return (tier, min_price is None, min_price if min_price is not None else 1e18, -timestamp)
        if sort_key == "price_desc":
            return (tier, min_price is None, -(min_price if min_price is not None else 0), -timestamp)
        if sort_key == "proximity":
            return (tier, -timestamp)
        if sort_key == "rating":
            average = float(vendor.get("review_average") or 0)
            count = int(vendor.get("review_count") or 0)
            return (tier, -average, -count, -timestamp)
        return (tier, -float(vendor.get("_score") or 0), -timestamp)

    return ordering


def _with_signals(vendor: dict[str, Any], signals: VendorSignals | None) -> dict[str, Any]:
    """The vendor with their public trust signals filled in."""
    found = signals or VendorSignals()
    vendor.update(
        review_average=found.review_average,
        review_count=found.review_count,
        completed_bookings=found.completed_bookings,
        avg_response_seconds=found.avg_response_seconds,
        conversion_rate=found.conversion_rate,
    )
    return vendor


def rank_vendors(
    vendors: list[ListedVendor],
    filters: SearchFilters,
    signals: dict[str, VendorSignals],
    *,
    limit: int,
    offset: int,
    service_match_counts_as_exact: bool = False,
) -> SearchResult:
    """Score, tier and sort the candidate vendors, returning one page.

    Exact: offers a searched service, hits a keyword and is free on the dates.
    Related: a looser service, keyword or place match, or exact but busy on the dates.
    Fallback (only when nothing else matched): vendors in the searched services at
    half score, else everyone at a quarter.
    """
    primary_types = filters.primary_types
    related_types = [key for key in filters.related_types if key not in primary_types]
    keywords = filters.keywords
    related_keywords = filters.related_keywords
    fallback_type_pool = primary_types or related_types
    date_softened = False

    exact_rows: list[dict[str, Any]] = []
    related_rows: list[dict[str, Any]] = []
    candidates: dict[str, dict[str, Any]] = {}

    for vendor in vendors:
        payload = vendor.payload
        if not vendor.user_id:
            continue
        within_budget, min_price = _passes_budget(
            payload, budget_min=filters.budget_min, budget_max=filters.budget_max
        )
        if not within_budget:
            continue

        services = _services_offered(payload)
        base_city = str(payload.get("baseCity") or "")
        haystack = _haystack(vendor)
        available = (
            vendor_available_on(payload, filters.date_parts) if filters.apply_date_availability else True
        )

        primary_hits = [key for key in primary_types if key in services]
        related_hits = [key for key in related_types if key in services]
        type_ok_exact = not primary_types or bool(primary_hits)
        type_ok_related = bool(related_hits) or (bool(primary_types) and bool(primary_hits))

        keyword_hits = _keyword_hits(haystack, keywords)
        related_keyword_hits = _keyword_hits(haystack, related_keywords)
        keyword_ok_exact = not keywords or keyword_hits > 0
        if service_match_counts_as_exact and primary_hits:
            keyword_ok_exact = True
        # A plan need with a service key but no keywords matches on the service alone.
        if primary_types and not keywords:
            keyword_ok_exact = True
        keyword_ok_related = (
            keyword_hits > 0 or related_keyword_hits > 0 or (not keywords and not related_keywords)
        )
        if primary_types and primary_hits and not keywords:
            keyword_ok_related = True
        if service_match_counts_as_exact and primary_hits:
            keyword_ok_related = True

        city = base_city.strip().lower()
        primary_place_hit = _overlaps(filters.location_filter.strip().lower(), city)
        related_place_hit = any(
            _overlaps(related.strip().lower(), city) for related in filters.related_locations
        )

        vendor_event_types = _event_types_offered(payload)
        event_type_hits = len([key for key in filters.parsed_event_types if key in vendor_event_types])

        matched_services = list(dict.fromkeys(primary_hits + related_hits)) if primary_types else services
        type_hits = len(primary_hits) if primary_types else max(1, len(services))
        score = (
            type_hits * 10.0
            + _location_bonus(filters.location_filter, base_city, filters.related_locations)
            + keyword_hits * 3.0
            + related_keyword_hits * 1.5
            + event_type_hits * 2.0
        )
        if primary_place_hit:
            score += 0.5

        ranked = {
            **vendor.model_dump(),
            "matched_services": matched_services,
            "_min_price": min_price,
            "_ts": _updated_timestamp(vendor.updated_at),
            "_score": score,
        }
        candidates[vendor.user_id] = ranked

        if type_ok_exact and keyword_ok_exact and available:
            exact_rows.append({**ranked, "match_tier": "exact"})
            continue

        related_ok = type_ok_related and (keyword_ok_related or related_place_hit or primary_place_hit)
        if type_ok_exact and not available and filters.apply_date_availability:
            related_ok = True
            date_softened = True
        if (
            type_ok_exact
            and not keyword_ok_exact
            and (related_keyword_hits > 0 or related_place_hit or primary_hits)
        ):
            related_ok = True
        if related_ok:
            related_rows.append({**ranked, "match_tier": "related"})

    exact_ids = {row["user_id"] for row in exact_rows}
    related_rows = [row for row in related_rows if row["user_id"] not in exact_ids]

    fallback_rows: list[dict[str, Any]] = []
    if not exact_rows and not related_rows:
        for candidate in candidates.values():
            if fallback_type_pool and not any(
                key in _services_offered(candidate["payload"]) for key in fallback_type_pool
            ):
                continue
            fallback_rows.append({**candidate, "match_tier": "fallback", "_score": candidate["_score"] * 0.5})
        if not fallback_rows:
            fallback_rows = [
                {**candidate, "match_tier": "fallback", "_score": candidate["_score"] * 0.25}
                for candidate in candidates.values()
            ]

    enriched = [
        _with_signals(row, signals.get(row["user_id"])) for row in exact_rows + related_rows + fallback_rows
    ]
    enriched.sort(key=_sort_key(filters.sort_key))
    for row in enriched:
        for private_key in ("_min_price", "_ts", "_score"):
            row.pop(private_key, None)

    has_exact = any(row["match_tier"] == "exact" for row in enriched)
    has_related = any(row["match_tier"] == "related" for row in enriched)
    has_fallback = any(row["match_tier"] == "fallback" for row in enriched)
    return SearchResult(
        vendors=enriched[offset : offset + limit],
        match_notice=match_notice(
            has_exact=has_exact,
            has_related=has_related,
            has_fallback=has_fallback,
            intent_summary=filters.intent_summary,
            date_softened=date_softened,
        ),
        has_exact=has_exact,
        has_related=has_related,
        total_count=len(enriched),
        intent_summary=filters.intent_summary,
    )


def plan_sections(
    vendors: list[ListedVendor],
    filters: SearchFilters,
    signals: dict[str, VendorSignals],
    *,
    needs: list[MarketplacePlanNeed],
    plan_title: str | None,
) -> SearchResult:
    """The plan layout: one section per need, each vendor under the first need that matches them.

    A section's `total_count` is its unclaimed pool before the card limit, so the web
    can offer "See more". Needs with no vendors are left out.
    """
    sections: list[SearchSection] = []
    flat: list[dict[str, Any]] = []
    claimed_ids: set[str] = set()
    has_exact = False
    has_related = False
    pool_limit = max(PLAN_SECTION_VENDOR_LIMIT * _PLAN_RANK_POOL_MULTIPLIER, _PLAN_RANK_POOL_MIN)
    event_types = filters.parsed_event_types

    for need in needs[:PLAN_MAX_NEEDS]:
        need_filters = SearchFilters(
            **{
                **filters.__dict__,
                "primary_types": [need.service_key],
                "related_types": [],
                "keywords": list(need.keywords),
                "related_keywords": [],
            }
        )
        ranked = rank_vendors(
            vendors,
            need_filters,
            signals,
            limit=pool_limit,
            offset=0,
            # A section cares that the vendor offers the service; keywords only lift the rank.
            service_match_counts_as_exact=True,
        )
        has_exact = has_exact or ranked.has_exact
        has_related = has_related or ranked.has_related

        unclaimed = [row for row in ranked.vendors if row["user_id"] not in claimed_ids]
        section_vendors = unclaimed[:PLAN_SECTION_VENDOR_LIMIT]
        if not section_vendors:
            continue
        hint = _MATCH_HINT_BY_SERVICE.get(need.service_key)
        for row in section_vendors:
            claimed_ids.add(row["user_id"])
            row["match_hint"] = hint
        sections.append(
            SearchSection(
                need_id=need.id,
                label=need.label,
                service_key=need.service_key,
                optional=need.optional,
                vendors=section_vendors,
                total_count=len(unclaimed),
                why=why_for_need(
                    service_key=need.service_key, event_types=event_types, rationale=need.rationale
                ),
            )
        )
        flat.extend(section_vendors)

    enriched_needs = [
        need.model_copy(
            update={
                "rationale": why_for_need(
                    service_key=need.service_key, event_types=event_types, rationale=need.rationale
                )
            }
        )
        for need in needs[:PLAN_MAX_NEEDS]
    ]
    title = (plan_title or filters.intent_summary or "Ideas for your event").strip()[:160]
    return SearchResult(
        vendors=flat,
        match_notice=None,
        has_exact=has_exact,
        has_related=has_related,
        total_count=len(flat),
        search_mode="plan",
        intent_summary=filters.intent_summary,
        plan=SearchPlan(
            title=title,
            event_types=list(event_types),
            needs=enriched_needs,
            intent_summary=filters.intent_summary,
        ),
        sections=sections,
    )


def snippet_preferences(result: SearchResult) -> dict[str, list[str]]:
    """For each plan vendor, the words a quote should mention to fit their section."""
    preferences: dict[str, list[str]] = {}
    for section in result.sections:
        terms = REVIEW_PREFER_TERMS.get(section.service_key) or []
        if not terms:
            continue
        for row in section.vendors:
            preferences[row["user_id"]] = terms
    return preferences


def attach_snippets(result: SearchResult, snippets: dict[str, FeaturedReview]) -> None:
    """Put each vendor's chosen review quote on their card (real reviews only, never invented)."""
    for row in result.vendors:
        snippet = snippets.get(row["user_id"])
        if snippet:
            row["featured_review"] = snippet.model_dump()
