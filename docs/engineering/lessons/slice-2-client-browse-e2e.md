# Slice 2 — Client browse: complete end-to-end code

**Branch:** `cursor/engineering-course-28c8` (synced with `main` — LLM-only `search_ai.py`)  
**User story:** Guest or client opens `/client/browse`; the page calls `GET /api/v1/vendors/explore/search` and renders vendor cards.

---

## Route map (accurate)

| Layer | Path |
|-------|------|
| Browser URL | `/client/browse` → `frontend/app/client/(portal)/browse/page.tsx` |
| API (browse list) | `GET /api/v1/vendors/explore/search` |
| Next rewrite | `/api/v1/:path*` → FastAPI (`frontend/next.config.ts`) |
| FastAPI mount | `app.include_router(api_router, prefix="/api/v1")` |
| Explore router | `APIRouter(prefix="/vendors")` in `explore.py` |
| Handler | `get_explore_vendors_search` → `search_approved_vendors` |

**Not used on browse page:** `GET /api/v1/vendors/explore` (full dump — landing/category counts use it).

---

## Part A — Frontend

### A1. Browse page

`frontend/app/client/(portal)/browse/page.tsx` — entire file:

```tsx
"use client";

import { Suspense } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { MarketplaceExploreView } from "@/features/marketplace/MarketplaceExploreView";

function ClientBrowsePageContent() {
  const { user } = useAuth();
  return <MarketplaceExploreView embedded={user?.user_type === "client"} />;
}

export default function ClientBrowsePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading browse…" variant="centered" branded />}>
      <ClientBrowsePageContent />
    </Suspense>
  );
}
```

### A2. URL → filter state

`frontend/lib/marketplaceSearchParams.ts` — `MARKETPLACE_PAGE_SIZE = 6`, read/write URL.

Open on GitHub: `frontend/lib/marketplaceSearchParams.ts` (full file ~160 lines).

Bare `/client/browse` → `country=GB`, `page=1`, empty `query`/`types`.

### A3. Fetch when URL changes

`frontend/features/marketplace/MarketplaceExploreView.tsx` — the `useEffect` that loads vendors:

```tsx
  useEffect(() => {
    if (savedOnly && !bookmarksReady) return;
    if (savedOnly && bookmarksReady && savedIds.size === 0) {
      setVendors([]);
      setTotalCount(0);
      setMatchNotice(null);
      setSearchMode("simple");
      setPlan(null);
      setSections([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const page = state.page;
        const result = await fetchExploreVendorsSearch({
            query: state.query || undefined,
            types: state.types.length ? state.types : undefined,
            location: state.location || undefined,
            country: state.country,
            dates: state.dates,
            flexible: state.dateFlexible,
            budgetMin: state.budgetMin,
            budgetMax: state.budgetMax,
            sort: state.sort,
            vendorIds: savedOnly ? favoriteVendorIds : searchVendorIds,
            limit: MARKETPLACE_PAGE_SIZE,
            offset: (page - 1) * MARKETPLACE_PAGE_SIZE,
          });
        if (!cancelled) {
          setVendors(result.vendors);
          setTotalCount(result.totalCount);
          setMatchNotice(result.matchNotice);
          setSearchMode(result.searchMode);
          setPlan(result.plan);
          setSections(result.sections);
        }
      } catch {
        if (!cancelled) setError("Could not load vendors right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchKey, state, savedOnly, bookmarksReady, favoriteVendorIds, searchVendorIds, savedIds.size]);
```

Result → `vendors` state → `MarketplaceVendorCard` grid.

### A4. HTTP client

`frontend/lib/clientExploreApi.ts` — `fetchExploreVendorsSearch` (entire function):

```typescript
export async function fetchExploreVendorsSearch(
  q: ExploreSearchQuery,
): Promise<ExploreVendorsSearchResult> {
  const sp = new URLSearchParams();
  const searchText = (q.query?.trim() || q.location?.trim()) ?? "";
  if (searchText) sp.set("q", searchText);
  if (q.types?.length) sp.set("types", q.types.join(","));
  if (q.location?.trim() && q.query?.trim()) {
    sp.set("location", q.location.trim());
  }
  if (q.dates?.length && !q.flexible) {
    sp.set("dates", q.dates.slice(0, 3).join(","));
  }
  if (q.flexible) sp.set("flexible", "true");
  if (q.budgetMin != null) sp.set("budget_min", String(q.budgetMin));
  if (q.budgetMax != null) sp.set("budget_max", String(q.budgetMax));
  if (q.sort && q.sort !== "relevance") sp.set("sort", q.sort);
  if (q.country) sp.set("country", q.country);
  if (q.vendorIds?.length) sp.set("vendor_ids", q.vendorIds.join(","));
  if (q.limit != null) sp.set("limit", String(q.limit));
  if (q.offset != null && q.offset > 0) sp.set("offset", String(q.offset));

  const qs = sp.toString();
  const cached = _searchResultCache.get(qs);
  if (cached && Date.now() - cached.at < _SEARCH_CACHE_TTL_MS) {
    return cached.result;
  }

  const url = qs
    ? `/api/v1/vendors/explore/search?${qs}`
    : "/api/v1/vendors/explore/search";
  const { data } = await api.get<ExploreVendorSearchApiResponse>(url);
  const result: ExploreVendorsSearchResult = {
    totalCount: data.total_count ?? 0,
    vendors: data.vendors ?? [],
    matchNotice: data.match_notice ?? null,
    hasExact: Boolean(data.has_exact),
    hasRelated: Boolean(data.has_related),
    searchMode: data.search_mode === "plan" ? "plan" : "simple",
    intentSummary: data.intent_summary ?? null,
    plan: data.plan ?? null,
    sections: data.sections ?? [],
  };
  _searchResultCache.set(qs, { at: Date.now(), result });
  if (_searchResultCache.size > 24) {
    const oldest = _searchResultCache.keys().next().value;
    if (oldest != null) _searchResultCache.delete(oldest);
  }
  return result;
}
```

---

## Part B — Backend HTTP

### B1. Entire `explore.py`

Open on GitHub: `backend/app/features/vendors/http/explore.py` (211 lines).

Search handler delegates to `search_approved_vendors` and wraps result in `ExploreVendorSearchResponse`.

---

## Part C — `search_approved_vendors` (full)

File: `backend/app/features/vendors/search.py`

```python
def search_approved_vendors(
    *,
    types: str | None = None,
    location: str | None = None,
    q: str | None = None,
    dates: str | None = None,
    flexible: bool = False,
    budget_min: float | None = None,
    budget_max: float | None = None,
    sort: str = "relevance",
    vendor_user_ids: list[str] | None = None,
    country: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> MarketplaceSearchResult:
    """
    Return approved vendors with optional filters, ordered exact → related → fallback.

    Planning-style queries (mode=plan) return need sections with vendors per checklist item.
    """
    chip_types = _parse_types_param(types)
    date_parts = _parse_dates_param(dates)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    raw_q = (q or "").strip()
    market_country = normalize_country_code(country)
    parsed = parse_marketplace_query(raw_q, country_code=market_country) if raw_q else None

    city_query = (location or "").strip() or None
    if not city_query and parsed and parsed.location:
        city_query = parsed.location

    # SQL only applies chip filters from the URL. AI-parsed types stay in-memory
    # for ranking so plan mode can still return bakers + caterers together.
    plan_mode = bool(parsed and parsed.mode == "plan" and parsed.needs)
    rows = list_approved_vendors_for_explore(
        vendor_user_ids=vendor_user_ids,
        budget_min=budget_min,
        budget_max=budget_max,
        service_types=chip_types or None,
        city_query=city_query,
        country_code=market_country,
    )

    primary_types = list(chip_types)
    if not primary_types and parsed and parsed.types and not plan_mode:
        primary_types = list(parsed.types)

    related_types = list(parsed.related_types) if parsed else []
    related_types = [t for t in related_types if t not in primary_types]

    location_filter = (location or "").strip()
    if not location_filter and parsed and parsed.location:
        location_filter = parsed.location.strip()
    related_locations = list(parsed.related_locations) if parsed else []

    keywords: list[str] = list(parsed.keywords) if parsed else []
    if not keywords and raw_q:
        keywords = [w for w in raw_q.lower().split() if len(w) >= 2][:16]
    related_keywords: list[str] = list(parsed.related_keywords) if parsed else []

    parsed_event_types = list(parsed.event_types) if parsed else []
    intent_summary = parsed.intent_summary if parsed else None

    sort_key = sort.strip().lower() if sort else "relevance"
    if sort_key not in ("relevance", "price_asc", "price_desc", "proximity", "rating"):
        sort_key = "relevance"

    apply_date_availability = bool(date_parts) and not flexible

    if plan_mode and parsed:
        needs = list(parsed.needs)
        if chip_types:
            needs = [n for n in needs if n.service_key in chip_types] or needs
        result = _search_plan_sections(
            rows,
            needs=needs,
            location_filter=location_filter,
            related_locations=related_locations,
            parsed_event_types=parsed_event_types,
            date_parts=date_parts,
            apply_date_availability=apply_date_availability,
            budget_min=budget_min,
            budget_max=budget_max,
            sort_key=sort_key,
            intent_summary=intent_summary,
            plan_title=parsed.plan_title,
        )
        return result

    result = _rank_candidates(
        rows,
        primary_types=primary_types,
        related_types=related_types,
        keywords=keywords,
        related_keywords=related_keywords,
        location_filter=location_filter,
        related_locations=related_locations,
        parsed_event_types=parsed_event_types,
        date_parts=date_parts,
        apply_date_availability=apply_date_availability,
        budget_min=budget_min,
        budget_max=budget_max,
        sort_key=sort_key,
        intent_summary=intent_summary,
        limit=limit,
        offset=offset,
    )
    result.search_mode = "simple"
    result.intent_summary = intent_summary
    return result
```

**Plain English walk of `search_approved_vendors`:**

1. Parse URL `types` and `dates` strings into lists.
2. If `q` present → `parse_marketplace_query` in `search_ai.py` (LLM-only; see Part H).
3. **`list_approved_vendors_for_explore`** — DB pool (listable + country + optional SQL filters).
4. Build `primary_types`, `keywords`, `location_filter` from URL + AI parse.
5. **Plan mode** → `_search_plan_sections` (sections per need).
6. **Simple mode** → `_rank_candidates` (exact / related / fallback tiers, sort, paginate).
7. Return `MarketplaceSearchResult` dataclass.

---

## Part D — DB pool

### D1. `list_approved_vendors_for_explore`

`backend/app/features/vendors/moderation.py` lines 493–569 — queries `vendors` via `get_db()`, applies `apply_public_listing_filters`, `country_code`, optional `services_offered`, city, budget.

### D2. `apply_public_listing_filters`

`backend/app/features/vendors/visibility.py` — entire file (107 lines):

- `approval_status = approved`
- not `listing_override = hidden`
- Stripe ready OR `listing_override = visible`

---

## Part E — `_rank_candidates` (simple browse mode)

File: `backend/app/features/vendors/search.py` lines 264–495.

For each row in the DB pool:

1. Skip if budget fails (`_passes_budget` on packages in `payload`).
2. Read `servicesOffered`, `baseCity`, build text haystack.
3. Check date availability if dates in URL.
4. Classify `match_tier`: `exact` | `related` | `fallback`.
5. Merge `review_average`, `completed_bookings`, etc.
6. Sort by tier then relevance/price/rating.
7. `total_count = len(all)`; `page = enriched[offset:offset+limit]`.

Bare browse (no filters): everyone in pool → `exact` tier → first 6 after sort.

---

## Part F — Response contracts

`backend/app/contracts/vendor.py`:

- `ExploreVendorRow` — `profile_form_data` aliases `payload`
- `ExploreVendorSearchRow` — adds `matched_services`, `match_tier`
- `ExploreVendorSearchResponse` — `vendors`, `total_count`, `sections`, `plan`

`explore.py` returns Pydantic models → JSON → frontend `ExploreVendorSearchRow[]`.

---

## Part G — Back to UI

`MarketplaceExploreView` maps `result.vendors` → `expandVendorsForSearchResults` → `MarketplaceVendorCard`.

Card reads `vendor.profile_form_data.businessName`, `baseCity`, `servicesOffered`, prices from `buildBrowsePricingOptions`.

---

## Part H — `search_ai.py` (LLM-only query parse)

**File:** `backend/app/features/vendors/search_ai.py` (~410 lines after refactor)

### What changed on `main`

| Removed | Still there |
|---------|-------------|
| `_fallback_parse` with synonym maps (`baker` → `baking`) | LLM via `parse_completion` → `_LlmMarketplaceParse` |
| Regex plan detection (`_PLAN_INTENT_RE`) | `_sanitize_parse_result` — taxonomy + length clamps |
| Canned birthday/wedding checklists (`_CANNED_NEEDS`) | `_collapse_needs_by_service` — one section per service key |
| Event-type regex + static `why_for_need` maps | `_token_only_parse` — emergency keywords-only path |

### Parse flow

```
parse_marketplace_query(raw_q)
  → normalize + cache key v5:{country}:{normalized}
  → _parse_with_llm
      → try_openai_client() missing? → _token_only_parse
      → parse_completion(...) OK? → _sanitize_parse_result
      → exception? → _token_only_parse
```

**Token-only fallback** (`_token_only_parse`) — used when OpenAI is down:

```python
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
```

Tests in `backend/tests/test_marketplace_search.py` assert token-only does **not** map “baker” to `baking` and does **not** invent a birthday plan.

### Three browse scenarios (current code)

| Scenario | URL / `q` | `search_ai` | `search.py` fork |
|----------|-----------|-------------|------------------|
| **1 — bare browse** | `/client/browse` (no `q`) | Skipped | `_rank_candidates` on full approved pool; 6 cards (`MARKETPLACE_PAGE_SIZE`) |
| **2 — simple hunt** | `q=photographers in Leeds` | LLM → usually `mode=simple`, `types` may include `photography`, `location=Leeds` | `_rank_candidates`; city may also hit SQL via `city_query` |
| **3 — plan checklist** | `q=help me plan my birthday` | LLM → `mode=plan`, `needs` (cake, food, photos…) | `_search_plan_sections` → `sections` + `plan` in JSON |

If OpenAI fails in scenario 2 or 3, both collapse to **simple keyword ranking** — no plan sections.

### Export for tests

- `sanitize_marketplace_parse_result` — pure sanitize, no network
- `token_only_marketplace_parse` — keywords-only path (replaces old `fallback_parse_marketplace_query`)

---

## File index (open in order)

1. `frontend/app/client/(portal)/browse/page.tsx`
2. `frontend/features/marketplace/MarketplaceExploreView.tsx`
3. `frontend/lib/marketplaceSearchParams.ts`
4. `frontend/lib/clientExploreApi.ts`
5. `backend/app/main.py` (prefix `/api/v1`)
6. `backend/app/http/router.py` (include explore router)
7. `backend/app/features/vendors/http/explore.py`
8. `backend/app/features/vendors/search.py` ← **`search_approved_vendors`**
9. `backend/app/features/vendors/search_ai.py` ← **`parse_marketplace_query`**
10. `backend/app/features/vendors/moderation.py` ← **`list_approved_vendors_for_explore`**
11. `backend/app/features/vendors/visibility.py`
12. `backend/app/contracts/vendor.py`
13. `backend/app/features/bookings/reviews.py` ← `merge_review_stats_into_vendor_rows`
14. `backend/app/features/vendors/public_metrics.py` ← `merge_public_metrics_into_vendor_rows`
15. `backend/tests/test_marketplace_search.py` ← parse + tier tests
