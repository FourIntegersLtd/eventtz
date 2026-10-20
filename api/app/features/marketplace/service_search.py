"""Marketplace search: understand the query (with the language model), then rank listed vendors.

The model's reading of a query is cached per market and normalised query for
`MARKETPLACE_SEARCH_AI_CACHE_TTL_SECONDS`. Without a model, or when it fails, the
query's own words are used as keywords, and that fallback is cached too.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.core.ports import LanguageModel
from app.core.settings import get_settings
from app.features.marketplace import repository_explore, service_explore
from app.features.marketplace.domain_metrics import choose_snippets
from app.features.marketplace.domain_query import (
    SEARCH_MODEL,
    MarketplaceQueryParseResult,
    ModelQueryParse,
    normalize_query,
    parse_messages,
    sanitize_parse_result,
    token_only_parse,
)
from app.features.marketplace.domain_search import (
    MAX_PAGE_SIZE,
    SearchResult,
    attach_snippets,
    is_plan_search,
    parse_dates_param,
    parse_types_param,
    plan_needs,
    plan_sections,
    rank_vendors,
    search_filters,
    snippet_preferences,
)
from app.features.marketplace.schemas import (
    ExplorePlanNeed,
    ExploreSearchPlan,
    ExploreSearchSection,
    ExploreVendorSearchResponse,
    ExploreVendorSearchRow,
)
from app.features.vendors import service_listing
from app.features.vendors.service_catalogue import normalize_country_code

log = get_logger(__name__)

# Bump when the prompt or the sanitising changes, so old readings are not reused.
_CACHE_VERSION = "v5"
# Query parse results by cache key: (monotonic expiry time, result).
_PARSE_CACHE: dict[str, tuple[float, MarketplaceQueryParseResult]] = {}


def _cache_get(key: str) -> MarketplaceQueryParseResult | None:
    """A cached reading that has not expired, else `None` (expired entries are dropped)."""
    ttl = max(0, get_settings().marketplace_search_ai_cache_ttl_seconds)
    entry = _PARSE_CACHE.get(key)
    if not entry:
        return None
    expires_at, result = entry
    if ttl <= 0 or time.monotonic() > expires_at:
        _PARSE_CACHE.pop(key, None)
        return None
    return result


def _cache_set(key: str, result: MarketplaceQueryParseResult) -> None:
    """Remember a reading; when full, the entry closest to expiry makes room."""
    settings = get_settings()
    ttl = max(0, settings.marketplace_search_ai_cache_ttl_seconds)
    if ttl <= 0:
        return
    if len(_PARSE_CACHE) >= max(1, settings.marketplace_search_ai_cache_max_entries):
        soonest_key = min(_PARSE_CACHE, key=lambda cached_key: _PARSE_CACHE[cached_key][0])
        _PARSE_CACHE.pop(soonest_key, None)
    _PARSE_CACHE[key] = (time.monotonic() + ttl, result)


async def parse_query(
    raw_query: str, *, country_code: str, language_model: LanguageModel
) -> MarketplaceQueryParseResult:
    """What the query asks for: filters, and a checklist of needs when it is event planning."""
    normalized = normalize_query(raw_query)
    if not normalized:
        return MarketplaceQueryParseResult()
    cache_key = f"{_CACHE_VERSION}:{country_code}:{normalized}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        reply = await asyncio.to_thread(
            language_model.parse,
            model=SEARCH_MODEL,
            messages=parse_messages(raw_query, country_code=country_code),
            reply_model=ModelQueryParse,
            purpose="marketplace_search_ai",
        )
        result = sanitize_parse_result(reply)
    except Exception as error:
        # Search must work without the model: fall back to the query's own words.
        log.warning("marketplace_search_ai: parse failed, using keywords only: %s", error)
        result = token_only_parse(raw_query)
    _cache_set(cache_key, result)
    return result


@dataclass(frozen=True)
class SearchRequest:
    """The search route's query parameters."""

    types: str | None = None
    location: str | None = None
    search: str | None = None
    dates: str | None = None
    flexible: bool = False
    budget_min: float | None = None
    budget_max: float | None = None
    sort: str = "relevance"
    vendor_ids: str | None = None
    country: str | None = None
    limit: int = DEFAULT_LIST_LIMIT
    offset: int = 0


def _vendor_id_filter(raw_ids: str | None) -> list[str] | None:
    """The comma-separated `vendor_ids` parameter as a list (first 500), or `None`."""
    if not raw_ids or not raw_ids.strip():
        return None
    vendor_ids = [part.strip() for part in raw_ids.split(",") if part.strip()]
    return vendor_ids[: service_listing.MAX_FILTER_IDS] or None


async def search_vendors(
    session: AsyncSession, viewer: Principal | None, request: SearchRequest, *, language_model: LanguageModel
) -> SearchResult:
    """Ranked vendors for a search (simple mode) or a checklist of sections (plan mode).

    The database applies only the URL's chips, budget, place and id filters; the
    parsed service types stay in memory so a plan can mix bakers and caterers.
    """
    chip_types = parse_types_param(request.types)
    date_parts = parse_dates_param(request.dates)
    limit = max(1, min(request.limit, MAX_PAGE_SIZE))
    offset = max(0, request.offset)
    raw_query = (request.search or "").strip()
    country_code = normalize_country_code(request.country)
    parsed = (
        await parse_query(raw_query, country_code=country_code, language_model=language_model)
        if raw_query
        else None
    )

    city_query = (request.location or "").strip() or (parsed.location if parsed else None) or None
    listed = await service_listing.listed_vendors(
        session,
        country_code=country_code,
        user_ids=_vendor_id_filter(request.vendor_ids),
        budget_min=request.budget_min,
        budget_max=request.budget_max,
        service_types=chip_types or None,
        city_query=city_query,
    )
    vendors = await service_explore.vendors_for_viewer(session, viewer, listed, country_code=country_code)
    signals = await service_explore.signals_for(session, [vendor.user_id for vendor in vendors])
    filters = search_filters(
        chip_types=chip_types,
        parsed=parsed,
        raw_query=raw_query,
        location=request.location,
        date_parts=date_parts,
        flexible=request.flexible,
        budget_min=request.budget_min,
        budget_max=request.budget_max,
        sort=request.sort,
    )

    if parsed is not None and is_plan_search(parsed):
        result = plan_sections(
            vendors, filters, signals, needs=plan_needs(parsed, chip_types), plan_title=parsed.plan_title
        )
        try:
            # Real review quotes only, never invented; one that mentions the section's service wins.
            candidates = await repository_explore.snippet_candidates(
                session, [row["user_id"] for row in result.vendors]
            )
            attach_snippets(result, choose_snippets(candidates, snippet_preferences(result)))
        except Exception:
            log.exception("plan search: featured review snippets failed")
        log.info("search plan needs=%s vendors=%s", len(result.sections), result.total_count)
        return result

    result = rank_vendors(vendors, filters, signals, limit=limit, offset=offset)
    log.info("search exact=%s related=%s total=%s", result.has_exact, result.has_related, result.total_count)
    return result


def search_response(result: SearchResult) -> ExploreVendorSearchResponse:
    """The search result as the route returns it."""
    plan = result.plan
    return ExploreVendorSearchResponse(
        total_count=result.total_count,
        vendors=[ExploreVendorSearchRow.model_validate(row) for row in result.vendors],
        match_notice=result.match_notice,
        has_exact=result.has_exact,
        has_related=result.has_related,
        search_mode=result.search_mode,
        intent_summary=result.intent_summary,
        plan=(
            ExploreSearchPlan(
                title=plan.title,
                event_types=list(plan.event_types),
                needs=[ExplorePlanNeed.model_validate(need.model_dump()) for need in plan.needs],
                intent_summary=plan.intent_summary,
            )
            if plan is not None
            else None
        ),
        sections=[
            ExploreSearchSection(
                need_id=section.need_id,
                label=section.label,
                service_key=section.service_key,
                optional=section.optional,
                vendors=[ExploreVendorSearchRow.model_validate(row) for row in section.vendors],
                total_count=section.total_count,
                why=section.why,
            )
            for section in result.sections
        ],
    )
