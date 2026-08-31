# Slice 2 — Browse flow walkthrough (thorough)

Read this when the route list is not enough. It traces **one HTTP request** from the browser URL through every function until vendor cards render.

**Browse list endpoint:** `GET /api/v1/vendors/explore/search`  
**Frontend orchestrator:** `useMarketplaceExplore` in `frontend/features/marketplace/useMarketplaceExplore.ts`  
**Backend orchestrator:** `search_approved_vendors` in `backend/app/features/vendors/search.py`  
**Query parser (only when `q` is non-empty):** `parse_marketplace_query` in `backend/app/features/vendors/search_ai.py`

---

## What changed since last lesson (2026-08-31)

- **`marketplaceStateToExploreQuery`** — hook no longer builds the API query inline; `marketplaceSearchParams.ts` maps URL state → `ExploreSearchQuery`.
- **`marketplaceSearchPrefillFromState` / `clientSearchContextFromBrowse`** — booking modal prefill and analytics context (planner `source` when `fromPlanner` is set).
- **Planner URL params** — `fromPlanner`, `eventName`, `venue`, `planNotes`, `event_id`, `vendor_ids` survive filter commits; auto-select for multi-enquire.
- **`get_optional_session_user` + `qa_visibility.py`** — explore reads optional session; `ExploreViewer` scopes QA test vendors to designated clients.
- **`apply_date_availability`** — date chips (when not flexible) affect ranking tiers in `search.py`; `vendorAvailability.ts` mirrors rules client-side.
- **`_merge_explore_vendor_rows`** — shared review/metrics merge in `explore.py` for list + detail.

---

## 0. Mental model (three layers)

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — URL state (frontend)                             │
│  /client/browse?q=…&types=…&sort=proximity&page=1         │
│  marketplaceSearchParams.ts ↔ useMarketplaceExplore         │
│  marketplaceStateToExploreQuery · planner URL params        │
│  MarketplaceExploreView (thin) + HeroMarketplaceSearch      │
│  + MarketplaceFiltersBar + useBrowseGeolocation             │
└───────────────────────────┬─────────────────────────────────┘
                            │ fetchExploreVendorsSearch()
┌───────────────────────────▼─────────────────────────────────┐
│  LAYER 2 — HTTP + orchestration (backend)                   │
│  explore.py → get_optional_session_user → ExploreViewer     │
│    → search_approved_vendors                                │
│    → (optional) search_ai.parse_marketplace_query           │
│    → moderation.list_approved_vendors_for_explore (SQL pool)│
│      → visibility.apply_public_listing_filters              │
│      → deleted_user_ids + filter_explore_rows (QA)          │
│    → _rank_candidates (apply_date_availability) OR plan     │
│    → _merge_explore_vendor_rows                             │
└───────────────────────────┬─────────────────────────────────┘
                            │ JSON ExploreVendorSearchResponse
┌───────────────────────────▼─────────────────────────────────┐
│  LAYER 3 — UI (frontend)                                    │
│  vendors[] or sections[] → MarketplaceVendorCard grid       │
└─────────────────────────────────────────────────────────────┘
```

**Two different “types” concepts (easy to confuse):**

| Name | Where | Meaning |
|------|--------|---------|
| URL `types` | `?types=photography,catering` | Filter chips in the URL. Applied in **SQL** via `services_offered`. |
| Parsed `types` | LLM output in `search_ai` | Service keys the model inferred from `q`. Used in **memory ranking**, not SQL (unless you also put them in URL). |

---

## 1. User opens a URL → React state

**File:** `frontend/app/client/(portal)/browse/page.tsx`

Renders `MarketplaceExploreView`. No fetch here — the hook does the work.

**File:** `frontend/features/marketplace/MarketplaceExploreView.tsx`

```58:60:frontend/features/marketplace/MarketplaceExploreView.tsx
  const { showToast } = useToast();
  const explore = useMarketplaceExplore(mode);
  const {
```

**File:** `frontend/features/marketplace/useMarketplaceExplore.ts`

```37:38:frontend/features/marketplace/useMarketplaceExplore.ts
  const state = useMemo(() => marketplaceStateFromSearchParams(sp), [sp]);
  const fetchKey = sp.toString();
```

`useSearchParams()` reads the browser URL. `marketplaceStateFromSearchParams` converts query string → `MarketplaceSearchState`.

**File:** `frontend/lib/marketplaceSearchParams.ts`

Example URL `/client/browse?q=photographers+in+Leeds&country=GB&page=1`:

| URL param | `MarketplaceSearchState` field |
|-----------|-------------------------------|
| `q` | `state.query` = `"photographers in Leeds"` |
| `types` | `state.types` = `[]` (if absent) |
| `location` | `state.location` = `""` (legacy param; also used when set in filters drawer) |
| `sort` | `state.sort` = `"relevance"` (or `proximity` after geolocation) |
| `country` | `state.country` = `"GB"` |
| `page` | `state.page` = `1` |
| `fromPlanner` | `state.fromPlannerPlanId` |
| `eventName` / `venue` / `planNotes` | planner event prefill fields |
| `event_id` | `state.linkedEventId` |
| `vendor_ids` | `state.vendorIds` |

`MARKETPLACE_PAGE_SIZE = 6` — each page asks the API for 6 vendors.

**API mapping** — `marketplaceStateToExploreQuery(state, { vendorIds, limit, offset })` converts URL state to `fetchExploreVendorsSearch` args (used in the hook fetch effect).

---

## 2. URL change triggers fetch (`useMarketplaceExplore`)

**File:** `frontend/features/marketplace/useMarketplaceExplore.ts`

When `fetchKey` (full query string) or dependencies change:

```82:130:frontend/features/marketplace/useMarketplaceExplore.ts
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
        const result = await fetchExploreVendorsSearch(
          marketplaceStateToExploreQuery(state, {
            vendorIds: savedOnly ? favoriteVendorIds : searchVendorIds,
            limit: MARKETPLACE_PAGE_SIZE,
            offset: (page - 1) * MARKETPLACE_PAGE_SIZE,
          }),
        );
        if (!cancelled) {
          setVendors(result.vendors);
          setTotalCount(result.totalCount);
          setMatchNotice(result.matchNotice);
          setSearchMode(result.searchMode);
          setPlan(result.plan);
          setSections(result.sections);
          track(MixpanelEvents.marketplace_results_viewed, {
            result_count: result.totalCount,
            page: state.page,
            saved_only: savedOnly,
            search_mode: result.searchMode,
          });
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

On success, the hook stores:

- `vendors` — flat list (simple mode)
- `sections` — grouped lists (plan mode)
- `searchMode` — `"simple"` | `"plan"`
- `plan` — checklist metadata
- `totalCount`, `matchNotice`

**Plan mode in the UI** only activates when:

```172:172:frontend/features/marketplace/useMarketplaceExplore.ts
  const isPlanMode = searchMode === "plan" && sections.length > 0 && !savedOnly;
```

So: API must return `search_mode: "plan"` **and** non-empty `sections`. If the LLM fails, you get simple mode even for “plan my birthday”.

**Geolocation side path** — when the user taps “Use current location” in `MarketplaceFiltersBar`, `useBrowseGeolocation` reverse-geocodes GPS and calls `commitFilters`, which updates the URL and retriggers this effect:

```21:28:frontend/features/marketplace/useBrowseGeolocation.ts
  const applyLocation = useCallback(
    (location: string) => {
      onCommit({
        ...state,
        location,
        sort: state.sort === "relevance" ? "proximity" : state.sort,
        page: 1,
      });
    },
```

---

## 3. Frontend builds the API URL

**File:** `frontend/lib/clientExploreApi.ts`

```143:175:frontend/lib/clientExploreApi.ts
export async function fetchExploreVendorsSearch(
  q: ExploreSearchQuery,
): Promise<ExploreVendorsSearchResult> {
  const sp = new URLSearchParams();
  const searchText = (q.query?.trim() || q.location?.trim()) ?? "";
  if (searchText) sp.set("q", searchText);
  if (q.types?.length) sp.set("types", q.types.join(","));
  if (q.location?.trim() && q.query?.trim()) {
    // Dedicated location (when distinct from q) - backend treats as soft signal.
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
```

**Important mapping:**

- Frontend `state.query` → API param `q`
- Frontend `state.location` (filters drawer / geolocation) → merged into `q` when `query` is empty; sent as separate `location` only when **both** query and location are set
- Frontend `state.sort` → API param `sort` (e.g. `proximity` after geolocation)
- Frontend `state.types` → API param `types` (comma-separated)

For `?q=photographers in Leeds`, the request is:

```
GET /api/v1/vendors/explore/search?q=photographers+in+Leeds&country=GB&limit=6&offset=0
```

Bare browse:

```
GET /api/v1/vendors/explore/search?country=GB&limit=6&offset=0
```

(no `q` param)

`api` from `frontend/lib/axios.ts` rewrites to FastAPI via Next `next.config.ts` proxy.

---

## 4. FastAPI receives the request

**File:** `backend/app/features/vendors/http/explore.py`

Router prefix `/vendors` + app prefix `/api/v1` → full path `/api/v1/vendors/explore/search`.

```116:154:backend/app/features/vendors/http/explore.py
@router.get("/explore/search", response_model=ExploreVendorSearchResponse)
def get_explore_vendors_search(
    request: Request,
    response: Response,
    types: str | None = Query(None, ...),
    location: str | None = Query(None, ...),
    q: str | None = Query(None, ...),
    # ...
    sort: str = Query(
        "relevance",
        description="relevance | price_asc | price_desc | proximity | rating",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ExploreVendorSearchResponse:
    viewer = explore_viewer_from_auth(get_optional_session_user(request, response))
    result = search_approved_vendors(
        types=types,
        location=location,
        q=q,
        # ...
        sort=sort,
        vendor_user_ids=_parse_vendor_ids(vendor_ids),
        country=country,
        limit=limit,
        offset=offset,
        viewer=viewer,
    )
```

This handler does **not** query the database itself. It:

1. Optionally resolves `ExploreViewer` from the session cookie (`get_optional_session_user`)
2. Calls `search_approved_vendors`
3. Maps internal `MarketplaceSearchResult` → `ExploreVendorSearchResponse` (Pydantic → JSON)

No auth guard — public read. Invalid cookies are treated as guest (no 401).

---

## 5. `search_approved_vendors` — the conductor

**File:** `backend/app/features/vendors/search.py` (function starts at line 668)

Read this function top to bottom. Everything else is called from here.

### Step 5a — Parse URL params locally

```689:692:backend/app/features/vendors/search.py
    chip_types = _parse_types_param(types)
    date_parts = _parse_dates_param(dates)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
```

`chip_types` = service keys from URL `types` param (filter chips), **not** from the LLM.

### Step 5b — Maybe call the LLM parser

```694:696:backend/app/features/vendors/search.py
    raw_q = (q or "").strip()
    market_country = normalize_country_code(country)
    parsed = parse_marketplace_query(raw_q, country_code=market_country) if raw_q else None
```

| `q` in request | `parsed` |
|----------------|----------|
| empty / missing | `None` — parser **never runs** |
| non-empty | `MarketplaceQueryParseResult` from LLM (or token-only fallback) |

### Step 5c — Decide SQL city filter

```698:700:backend/app/features/vendors/search.py
    city_query = (location or "").strip() or None
    if not city_query and parsed and parsed.location:
        city_query = parsed.location
```

SQL city filter comes from URL `location` **or** LLM `parsed.location`.

### Step 5d — Plan mode flag + load vendor pool

Plan mode requires LLM `mode == "plan"` and non-empty `needs`. If OpenAI is down, `_token_only_parse` returns `mode=simple` → **never plan mode**.

```704:713:backend/app/features/vendors/search.py
    plan_mode = bool(parsed and parsed.mode == "plan" and parsed.needs)
    rows = list_approved_vendors_for_explore(
        vendor_user_ids=vendor_user_ids,
        budget_min=budget_min,
        budget_max=budget_max,
        service_types=chip_types or None,
        city_query=city_query,
        country_code=market_country,
        viewer=viewer,
    )
```

**Critical:** `service_types` here is **only** `chip_types` (URL filter chips). LLM-parsed types are **not** passed to SQL. That lets plan mode return bakers + caterers in one response even when URL has no type chips.

### Step 5e — Build ranking inputs from URL + parse

```715:730:backend/app/features/vendors/search.py
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
```

| Field | Source priority |
|-------|-----------------|
| `primary_types` | URL chips first; else LLM `types` (simple mode only) |
| `keywords` | LLM keywords; else split `raw_q` on spaces |
| `location_filter` | URL `location`; else LLM `parsed.location` |

### Step 5f — Validate sort + date availability

```735:739:backend/app/features/vendors/search.py
    sort_key = sort.strip().lower() if sort else "relevance"
    if sort_key not in ("relevance", "price_asc", "price_desc", "proximity", "rating"):
        sort_key = "relevance"

    apply_date_availability = bool(date_parts) and not flexible
```

When `dates` are set and not `flexible`, `_rank_candidates` uses `_vendor_available_for_event_dates` — vendors blocked on those dates move to **related** tier instead of **exact**. Frontend `vendorAvailability.ts` mirrors the same blocked-date/weekday rules for booking UI.

### Step 5g — Fork: plan vs simple

```741:785:backend/app/features/vendors/search.py
    if plan_mode and parsed:
        # Optional chip filter: only keep needs matching selected types.
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
        ...
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

---

## 6. Database pool — who is even eligible?

**File:** `backend/app/features/vendors/moderation.py` — `list_approved_vendors_for_explore`

```596:598:backend/app/features/vendors/moderation.py
        city = (city_query or "").strip().lower()
        if city:
            query = query.ilike("base_city_normalized", f"%{city}%")
        res = query.execute()
```

Earlier in the same function: `apply_public_listing_filters`, country, budget, `services_offered` overlaps, then `filter_explore_rows(out, viewer)` for QA scoping.

**File:** `backend/app/features/vendors/qa_visibility.py` — QA test vendors hidden from guests:

```75:86:backend/app/features/vendors/qa_visibility.py
def filter_explore_rows(
    rows: list[dict[str, Any]],
    viewer: ExploreViewer | None,
) -> list[dict[str, Any]]:
    """Drop QA-scoped vendors unless the viewer is the designated test client."""
    out: list[dict[str, Any]] = []
    for row in rows:
        uid = str(row.get("user_id") or "")
        if is_qa_scoped_vendor(uid) and not viewer_may_see_qa_vendor(viewer, uid):
            continue
        out.append(row)
    return out
```

**Deleted users excluded** after SQL returns rows:

```618:643:backend/app/features/vendors/moderation.py
    data = getattr(res, "data", None) or []
    user_ids = [str(row.get("user_id")) for row in data if isinstance(row, dict) and row.get("user_id")]
    gone = deleted_user_ids(user_ids)
    ...
    for row in data:
        ...
        uid = str(row.get("user_id") or "")
        if uid in gone:
            continue
        out.append(
```

Plain English: approved, not hidden, Stripe ready **or** admin `visible`, not GDPR-deleted, QA-filtered for current viewer.

**Output:** `rows` = list of dicts with `user_id`, `email`, `payload` (profile JSON), `updated_at`. Ranking never hits SQL again — it scores this in-memory list.

---

## 7. LLM parser (`search_ai.py`) — only when `q` is set

**Entry:** `parse_marketplace_query(raw_q, country_code=...)`

```394:418:backend/app/features/vendors/search_ai.py
def parse_marketplace_query(raw_q, *, country_code=None):
    normalized = _normalize_query(raw_q)
    if not normalized:
        return MarketplaceQueryParseResult()

    market_country = normalize_country_code(country_code)
    cache_key = f"v5:{market_country}:{normalized}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result = _parse_with_llm(raw_q, country_code=market_country)
    _cache_set(cache_key, result)
    return result
```

### Inside `_parse_with_llm`

1. `try_openai_client()` — if no client → `_token_only_parse` (keywords only)
2. Build system + user prompts with allowed service/event keys
3. `parse_completion(..., response_format=_LlmMarketplaceParse)` — structured JSON from GPT
4. `_sanitize_parse_result(parsed_msg)` — clamp lengths, filter invalid taxonomy keys, collapse duplicate catering needs
5. On any exception → `_token_only_parse`

### `_token_only_parse` (degraded path)

```178:188:backend/app/features/vendors/search_ai.py
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

No `types`, no `location`, no `needs`. Ranking will rely on keyword text matching in vendor bios.

### Example LLM output for `q=photographers in Leeds`

```python
MarketplaceQueryParseResult(
    mode="simple",
    keywords=["photographers", "leeds"],
    location="Leeds",
    types=["photography"],
    related_types=[],
    event_types=[],
    intent_summary="Photographers in Leeds",
    needs=[],
)
```

### Example LLM output for `q=help me plan my birthday`

```python
MarketplaceQueryParseResult(
    mode="plan",
    keywords=["birthday"],
    event_types=["birthdays"],
    plan_title="Ideas for your birthday - cake, food, and more",
    needs=[
        MarketplacePlanNeed(id="cake", label="Birthday cake", service_key="baking", ...),
        MarketplacePlanNeed(id="food", label="Food for the party", service_key="catering", ...),
        MarketplacePlanNeed(id="photos", label="Photos", service_key="photography", optional=True, ...),
    ],
)
```

---

## 8. Simple mode — `_rank_candidates`

**File:** `backend/app/features/vendors/search.py` — starts at line 277

For **each vendor row** in the pool:

### 8a — Budget gate

`_passes_budget(payload, budget_min, budget_max)` — skip vendor if packages don't fit budget.

### 8b — Date availability (when `apply_date_availability`)

```323:327:backend/app/features/vendors/search.py
        available = (
            _vendor_available_for_event_dates(payload, date_parts)
            if apply_date_availability
            else True
        )
```

### 8c — Location match in memory

```350:358:backend/app/features/vendors/search.py
        loc_l = location_filter.strip().lower()
        city_l = base_city.strip().lower()
        primary_loc_hit = bool(loc_l and city_l and (loc_l in city_l or city_l in loc_l))
        related_loc_hit = False
        for rl in related_locations:
            r = rl.strip().lower()
            if r and city_l and (r in city_l or city_l in r):
                related_loc_hit = True
                break
```

`_relevance_score` adds `_location_bonus` when cities overlap.

### 8d — Classify match tier

| Tier | Meaning (simplified) |
|------|----------------------|
| `exact` | Types/keywords/location/date all match “primary” filters |
| `related` | Close match (related keywords, nearby city, wrong date but right service…) |
| `fallback` | No exact or related — show “similar” vendors if pool would be empty |

When **no filters** (bare browse): `primary_types` and `keywords` are empty → most vendors pass as `exact`.

### 8e — Score and sort

Computes `_score` from type hits, keyword hits, location, event types. Sort order:

1. Tier (`exact` before `related` before `fallback`)
2. Then by `sort` param: relevance score, price, **proximity** (`-updated_at` tie-break within tier), rating

```472:478:backend/app/features/vendors/search.py
        if sort_key == "proximity":
            return (tier, -ts)
        if sort_key == "rating":
            avg = float(r.get("review_average") or 0)
            cnt = int(r.get("review_count") or 0)
            return (tier, -avg, -cnt, -ts)
        return (tier, -sc, -ts)
```

### 8f — Paginate

```499:500:backend/app/features/vendors/search.py
    total_count = len(enriched)
    page = enriched[offset : offset + limit]
```

Returns `MarketplaceSearchResult(vendors=page, total_count=total_count, ...)`.

### 8g — Merge reviews + metrics

Before return, explore handlers call `_merge_explore_vendor_rows` (review stats + public metrics). Inside `_rank_candidates`, rows are enriched via:

- `merge_review_stats_into_vendor_rows`
- `merge_public_metrics_into_vendor_rows`

---

## 9. Plan mode — `_search_plan_sections`

**File:** `backend/app/features/vendors/search.py` — starts at line 516

For each `need` in the LLM checklist (e.g. cake → `baking`, food → `catering`):

1. Call `_rank_candidates` with:
   - `primary_types=[need.service_key]`
   - `keywords=need.keywords`
   - `service_match_counts_as_exact=True` (offering the service is enough)
   - `limit=pool_limit` (rank more than we show)
2. Remove vendors already shown in a previous section (`claimed_ids`)
3. Take first 8 cards per section (`_PLAN_SECTION_VENDOR_LIMIT`)
4. Build `MarketplaceSearchSection` with `why` from LLM rationale

Returns:

```python
MarketplaceSearchResult(
    search_mode="plan",
    plan=MarketplaceSearchPlan(title=..., needs=...),
    sections=[...],  # each has vendors[]
    vendors=flat,    # all section vendors flattened
    total_count=len(flat),
)
```

Frontend plan UI reads `sections`, not the flat `vendors` list for layout.

---

## 10. Response → frontend → cards

**explore.py** wraps result in `ExploreVendorSearchResponse` JSON.

**clientExploreApi.ts** maps to:

```typescript
{
  totalCount, vendors, matchNotice,
  searchMode, plan, sections,
}
```

**useMarketplaceExplore** stores these; **MarketplaceExploreView** renders:

- **Simple:** `exactCards` + `alsoConsiderCards` from `useMarketplaceExplore` → grid of `MarketplaceVendorCard`
- **Plan:** loops `sections`, each with heading + vendor cards; pagination hidden

**match_tier** on each card drives “Also consider” divider:

```261:275:frontend/features/marketplace/useMarketplaceExplore.ts
  const exactCards = useMemo(
    () =>
      visibleCards.filter(
        (card) => !card.vendor.match_tier || card.vendor.match_tier === "exact",
      ),
    [visibleCards],
  );
  const alsoConsiderCards = useMemo(
    () =>
      visibleCards.filter(
        (card) =>
          card.vendor.match_tier === "related" || card.vendor.match_tier === "fallback",
      ),
    [visibleCards],
  );
```

---

## 11. Three scenarios traced end-to-end

### Scenario A — Bare browse (no search text)

**URL:** `/client/browse`

| Step | What happens |
|------|----------------|
| URL → state | `query=""`, `page=1`, `country=GB`, `sort=relevance` |
| `useMarketplaceExplore` | `fetchExploreVendorsSearch({ country: "GB", limit: 6, offset: 0 })` |
| API call | `GET .../explore/search?country=GB&limit=6&offset=0` — **no `q`** |
| `parse_marketplace_query` | **Skipped** (`parsed=None`) |
| `plan_mode` | `False` |
| SQL pool | All listable GB vendors (no type/city SQL filter); `deleted_user_ids` applied |
| `primary_types`, `keywords` | empty |
| Ranking | `_rank_candidates` — everyone tends to `exact` tier |
| Response | `search_mode: "simple"`, 6 vendors, `total_count` = all listable |
| UI | Flat grid + pagination if total > 6 |

### Scenario B — Simple hunt: photographers in Leeds

**URL:** `/client/browse?q=photographers+in+Leeds`

| Step | What happens |
|------|----------------|
| `useMarketplaceExplore` | passes `query: "photographers in Leeds"` to `fetchExploreVendorsSearch` |
| API | `q=photographers in Leeds`, `limit=6` |
| LLM parse | `mode=simple`, `types=[photography]`, `location=Leeds`, keywords… |
| `plan_mode` | `False` |
| SQL | `city_query="Leeds"` → `ilike` on `base_city_normalized`; **no** type filter in SQL (chips empty) |
| `primary_types` | `["photography"]` from parsed types |
| Ranking | `_rank_candidates` — photographers in Leeds score highest; others may be `related`/`fallback` |
| UI | Simple grid; may show “Also consider” for related tiers |

If OpenAI fails: token-only keywords `["photographers", "in", "leeds"]`, no `types`, no SQL city from parser — weaker matches via text haystack only.

**Optional geolocation variant:** user taps “Use current location” → `useBrowseGeolocation` sets `location=Leeds` (or detected city) and `sort=proximity` → API includes `sort=proximity` and location in `q`.

### Scenario C — Plan: help me plan my birthday

**URL:** `/client/browse?q=help+me+plan+my+birthday`

| Step | What happens |
|------|----------------|
| `useMarketplaceExplore` | same fetch path; `q` contains plan phrase |
| LLM parse | `mode=plan`, `needs` = cake (baking), food (catering), photos (photography optional) |
| `plan_mode` | `True` |
| SQL pool | Full listable set (no chip types) |
| Ranking | `_search_plan_sections` — 3 sections, up to 8 vendors each |
| Response | `search_mode: "plan"`, `plan`, `sections[]` |
| `isPlanMode` | `true` in hook → `MarketplaceExploreView` renders section headings, checklist chips, no pagination |

If OpenAI fails: falls back to simple keyword search for “help”, “me”, “plan”, “my”, “birthday” — **no plan UI**.

---

## 12. Function call order (cheat sheet)

```
User opens /client/browse?...
  MarketplaceExploreView
    useMarketplaceExplore()
      marketplaceStateFromSearchParams()
      marketplaceStateToExploreQuery()
      fetchExploreVendorsSearch()
        GET /api/v1/vendors/explore/search
          explore.get_explore_vendors_search()
            get_optional_session_user() → ExploreViewer
            search_approved_vendors()
              [if q] parse_marketplace_query()
                _parse_with_llm() OR cache hit
                  parse_completion() → _sanitize_parse_result()
                  OR _token_only_parse()
              list_approved_vendors_for_explore()
                apply_public_listing_filters()
                get_db().table("vendors")...
                deleted_user_ids() → filter rows
                filter_explore_rows() → QA visibility
              [if plan_mode] _search_plan_sections()
                _rank_candidates() × N needs (apply_date_availability)
              [else] _rank_candidates() (apply_date_availability)
            _merge_explore_vendor_rows()
      setVendors / setSections / setSearchMode
  MarketplaceExploreView renders MarketplaceVendorCard grid
```

**Geolocation branch (parallel to search submit):**

```
MarketplaceFiltersBar "Use current location"
  useBrowseGeolocation.requestCurrentLocation()
    navigator.geolocation.getCurrentPosition()
    reverseGeocodeLocation()  // photonLocationAutocomplete.ts
    commitFilters({ location, sort: proximity })
      router.replace(buildMarketplaceSearchUrl(...))
        → retriggers useMarketplaceExplore fetch effect
```

---

## 13. Files to open when debugging

| Symptom | Open first |
|---------|------------|
| Wrong URL params | `marketplaceSearchParams.ts` (`marketplaceStateToExploreQuery`), `clientExploreApi.ts` |
| Fetch not firing | `useMarketplaceExplore.ts` (`fetchKey`, `useEffect`) |
| Geolocation / proximity | `useBrowseGeolocation.ts`, `MarketplaceFiltersBar.tsx` |
| Parser wrong / no plan | `search_ai.py`, OpenAI logs |
| Vendor missing entirely | `visibility.py`, `moderation.py`, `qa_visibility.py`, `deleted_user_ids` |
| Date filter ignored | `search.py` → `apply_date_availability`; `vendorAvailability.ts` |
| Wrong order / tiers | `search.py` → `_rank_candidates` |
| Plan sections empty | `search.py` → `_search_plan_sections`, LLM `needs` |
| UI shows wrong mode | `useMarketplaceExplore.ts` (`isPlanMode`) |
| Planner handoff lost | `marketplaceSearchParams.ts` — `fromPlanner`, `vendor_ids`, etc. |

---

## Related lessons

- `slice-2-client-browse.md` — routes, layout, and step-by-step lesson
- Slice 3a: `slice-3a-client-booking-enquire.md` — enquire from vendor profile
