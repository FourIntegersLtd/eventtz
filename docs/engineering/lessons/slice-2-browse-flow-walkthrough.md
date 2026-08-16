# Slice 2 — Browse flow walkthrough (thorough)

Read this when the route list is not enough. It traces **one HTTP request** from the browser URL through every function until vendor cards render.

**Browse list endpoint:** `GET /api/v1/vendors/explore/search`  
**Main orchestrator:** `search_approved_vendors` in `backend/app/features/vendors/search.py`  
**Query parser (only when `q` is non-empty):** `parse_marketplace_query` in `backend/app/features/vendors/search_ai.py`

---

## 0. Mental model (three layers)

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — URL state (frontend)                             │
│  /client/browse?q=…&types=…&page=1                        │
│  marketplaceSearchParams.ts ↔ MarketplaceExploreView        │
└───────────────────────────┬─────────────────────────────────┘
                            │ fetchExploreVendorsSearch()
┌───────────────────────────▼─────────────────────────────────┐
│  LAYER 2 — HTTP + orchestration (backend)                   │
│  explore.py → search_approved_vendors                         │
│    → (optional) search_ai.parse_marketplace_query           │
│    → moderation.list_approved_vendors_for_explore (SQL pool)│
│    → _rank_candidates OR _search_plan_sections              │
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

Renders `MarketplaceExploreView`. No fetch here — the child component does the work.

**File:** `frontend/features/marketplace/MarketplaceExploreView.tsx`

```83:84:frontend/features/marketplace/MarketplaceExploreView.tsx
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
| `location` | `state.location` = `""` (only set when both `q` and `location` exist) |
| `country` | `state.country` = `"GB"` |
| `page` | `state.page` = `1` |

`MARKETPLACE_PAGE_SIZE = 6` — each page asks the API for 6 vendors.

---

## 2. URL change triggers fetch

**File:** `frontend/features/marketplace/MarketplaceExploreView.tsx` (lines 130–185)

When `fetchKey` (full query string) or `state` changes:

1. `setLoading(true)`
2. Calls `fetchExploreVendorsSearch({ ... })` with:
   - `query` ← `state.query`
   - `types` ← `state.types` (if any)
   - `location` ← `state.location`
   - `limit` ← `6`
   - `offset` ← `(page - 1) * 6`
3. On success, stores:
   - `vendors` — flat list (simple mode)
   - `sections` — grouped lists (plan mode)
   - `searchMode` — `"simple"` | `"plan"`
   - `plan` — checklist metadata
   - `totalCount`

**Plan mode in the UI** only activates when:

```233:233:frontend/features/marketplace/MarketplaceExploreView.tsx
  const isPlanMode = searchMode === "plan" && sections.length > 0 && !savedOnly;
```

So: API must return `search_mode: "plan"` **and** non-empty `sections`. If the LLM fails, you get simple mode even for “plan my birthday”.

---

## 3. Frontend builds the API URL

**File:** `frontend/lib/clientExploreApi.ts`

```138:170:frontend/lib/clientExploreApi.ts
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
  // ... dates, budget, sort, country, vendor_ids, limit, offset ...
  const url = qs
    ? `/api/v1/vendors/explore/search?${qs}`
    : "/api/v1/vendors/explore/search";
  const { data } = await api.get<ExploreVendorSearchApiResponse>(url);
```

**Important mapping:**

- Frontend `state.query` → API param `q`
- Frontend `state.types` → API param `types` (comma-separated)
- Frontend `state.location` → only sent as separate `location` if **both** query and location are set

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

```96:130:backend/app/features/vendors/http/explore.py
@router.get("/explore/search", response_model=ExploreVendorSearchResponse)
def get_explore_vendors_search(
    types: str | None = Query(None, ...),
    location: str | None = Query(None, ...),
    q: str | None = Query(None, ...),
    # ...
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ExploreVendorSearchResponse:
    result = search_approved_vendors(
        types=types,
        location=location,
        q=q,
        # ...
        limit=limit,
        offset=offset,
    )
```

This handler does **not** query the database itself. It only:

1. Calls `search_approved_vendors`
2. Maps internal `MarketplaceSearchResult` → `ExploreVendorSearchResponse` (Pydantic → JSON)

No auth guard — public read.

---

## 5. `search_approved_vendors` — the conductor

**File:** `backend/app/features/vendors/search.py` (function starts at line 655)

Read this function top to bottom. Everything else is called from here.

### Step 5a — Parse URL params locally

```675:678:backend/app/features/vendors/search.py
    chip_types = _parse_types_param(types)
    date_parts = _parse_dates_param(dates)
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
```

`chip_types` = service keys from URL `types` param (filter chips), **not** from the LLM.

### Step 5b — Maybe call the LLM parser

```680:682:backend/app/features/vendors/search.py
    raw_q = (q or "").strip()
    market_country = normalize_country_code(country)
    parsed = parse_marketplace_query(raw_q, country_code=market_country) if raw_q else None
```

| `q` in request | `parsed` |
|----------------|----------|
| empty / missing | `None` — parser **never runs** |
| non-empty | `MarketplaceQueryParseResult` from LLM (or token-only fallback) |

### Step 5c — Decide SQL city filter

```684:686:backend/app/features/vendors/search.py
    city_query = (location or "").strip() or None
    if not city_query and parsed and parsed.location:
        city_query = parsed.location
```

SQL city filter comes from URL `location` **or** LLM `parsed.location`.

### Step 5d — Plan mode flag

```690:690:backend/app/features/vendors/search.py
    plan_mode = bool(parsed and parsed.mode == "plan" and parsed.needs)
```

Plan mode requires:

- LLM returned `mode == "plan"`
- LLM returned a non-empty `needs` list

If OpenAI is down, `_token_only_parse` returns `mode=simple` and empty `needs` → **never plan mode**.

### Step 5e — Load vendor pool from database

```691:698:backend/app/features/vendors/search.py
    rows = list_approved_vendors_for_explore(
        vendor_user_ids=vendor_user_ids,
        budget_min=budget_min,
        budget_max=budget_max,
        service_types=chip_types or None,
        city_query=city_query,
        country_code=market_country,
    )
```

**Critical:** `service_types` here is **only** `chip_types` (URL filter chips). LLM-parsed types are **not** passed to SQL. That lets plan mode return bakers + caterers in one response even when URL has no type chips.

### Step 5f — Build ranking inputs from URL + parse

```700:718:backend/app/features/vendors/search.py
    primary_types = list(chip_types)
    if not primary_types and parsed and parsed.types and not plan_mode:
        primary_types = list(parsed.types)

    related_types = list(parsed.related_types) if parsed else []
    # ...
    keywords: list[str] = list(parsed.keywords) if parsed else []
    if not keywords and raw_q:
        keywords = [w for w in raw_q.lower().split() if len(w) >= 2][:16]
```

| Field | Source priority |
|-------|-----------------|
| `primary_types` | URL chips first; else LLM `types` (simple mode only) |
| `keywords` | LLM keywords; else split `raw_q` on spaces |
| `location_filter` | URL `location`; else LLM `parsed.location` |

### Step 5g — Fork: plan vs simple

```726:781:backend/app/features/vendors/search.py
    if plan_mode and parsed:
        result = _search_plan_sections(...)
        return result

    result = _rank_candidates(...)
    result.search_mode = "simple"
    return result
```

---

## 6. Database pool — who is even eligible?

**File:** `backend/app/features/vendors/moderation.py` — `list_approved_vendors_for_explore`

```493:525:backend/app/features/vendors/moderation.py
def list_approved_vendors_for_explore(...) -> list[dict[str, Any]]:
    query = apply_recent_first_order(
        apply_public_listing_filters(
            get_db().table("vendors").select(select_cols),
        ).eq("country_code", country),
        column="updated_at",
    )
    if vendor_user_ids:
        query = query.in_("user_id", vendor_user_ids[:500])
    if budget_min is not None:
        query = query.gte("min_list_price_gbp", budget_min)
    if budget_max is not None:
        query = query.lte("min_list_price_gbp", budget_max)
    if service_types:
        query = query.overlaps("services_offered", service_types)
    city = (city_query or "").strip().lower()
    if city:
        query = query.ilike("base_city_normalized", f"%{city}%")
    res = query.execute()
```

Then joins emails from `users` table.

**File:** `backend/app/features/vendors/visibility.py` — `apply_public_listing_filters`

```43:49:backend/app/features/vendors/visibility.py
def apply_public_listing_filters(query: Any) -> Any:
    return (
        query.eq("approval_status", "approved")
        .neq("listing_override", "hidden")
        .or_(f"listing_override.eq.visible,and({_STRIPE_READY_FILTER})")
    )
```

Plain English: approved, not hidden, and (Stripe ready **or** admin marked `visible`).

**Output:** `rows` = list of dicts, each like:

```python
{
  "user_id": "...",
  "email": "...",
  "approval_status": "approved",
  "payload": {  # vendor profile JSON
    "businessName": "...",
    "baseCity": "Leeds",
    "servicesOffered": ["photography", "catering"],
    "packages": [...],
    "availableWeekdays": [0,1,2,3,4,5,6],
    "blockedDates": [],
    ...
  },
  "updated_at": "...",
}
```

Ranking never hits SQL again — it scores this in-memory list.

---

## 7. LLM parser (`search_ai.py`) — only when `q` is set

**Entry:** `parse_marketplace_query(raw_q, country_code=...)`

```380:404:backend/app/features/vendors/search_ai.py
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

```165:175:backend/app/features/vendors/search_ai.py
def _token_only_parse(raw_q: str) -> MarketplaceQueryParseResult:
    normalized = _normalize_query(raw_q)
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

**File:** `backend/app/features/vendors/search.py` — starts at line 264

For **each vendor row** in the pool:

### 8a — Budget gate

`_passes_budget(payload, budget_min, budget_max)` — skip vendor if packages don't fit budget.

### 8b — Read profile fields

- `svcs` = `payload.servicesOffered` (e.g. `["photography"]`)
- `base_city` = `payload.baseCity`
- `hay` = searchable text blob (name, bio, services, city…)

### 8c — Classify match tier

| Tier | Meaning (simplified) |
|------|----------------------|
| `exact` | Types/keywords/location/date all match “primary” filters |
| `related` | Close match (related keywords, nearby city, wrong date but right service…) |
| `fallback` | No exact or related — show “similar” vendors if pool would be empty |

Core exact check (lines 384–386):

```384:386:backend/app/features/vendors/search.py
        if type_ok_exact and keyword_ok_exact and available:
            exact_rows.append({**out_row, "match_tier": "exact"})
            continue
```

When **no filters** (bare browse): `primary_types` and `keywords` are empty → most vendors pass as `exact`.

### 8d — Score and sort

Computes `_score` from type hits, keyword hits, location, event types. Sort order:

1. Tier (`exact` before `related` before `fallback`)
2. Then by `sort` param: relevance score, price, rating, etc.

### 8e — Paginate

```486:487:backend/app/features/vendors/search.py
    total_count = len(enriched)
    page = enriched[offset : offset + limit]
```

Returns `MarketplaceSearchResult(vendors=page, total_count=total_count, ...)`.

### 8f — Merge reviews + metrics

Before return, each row gets `review_average`, `review_count`, `completed_bookings`, etc. from:

- `merge_review_stats_into_vendor_rows`
- `merge_public_metrics_into_vendor_rows`

---

## 9. Plan mode — `_search_plan_sections`

**File:** `backend/app/features/vendors/search.py` — starts at line 503

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

**MarketplaceExploreView:**

- **Simple:** `expanded = expandVendorsForSearchResults(vendors)` → grid of `MarketplaceVendorCard`
- **Plan:** loops `sections`, each with heading + `why` + vendor cards; pagination hidden

**match_tier** on each card drives “Also consider” divider:

```338:351:frontend/features/marketplace/MarketplaceExploreView.tsx
  const exactCards = visibleCards.filter(
    (card) => !card.vendor.match_tier || card.vendor.match_tier === "exact",
  );
  const alsoConsiderCards = visibleCards.filter(
    (card) =>
      card.vendor.match_tier === "related" || card.vendor.match_tier === "fallback",
  );
```

---

## 11. Three scenarios traced end-to-end

### Scenario A — Bare browse (no search text)

**URL:** `/client/browse`

| Step | What happens |
|------|----------------|
| URL → state | `query=""`, `page=1`, `country=GB` |
| API call | `GET .../explore/search?country=GB&limit=6&offset=0` — **no `q`** |
| `parse_marketplace_query` | **Skipped** (`parsed=None`) |
| `plan_mode` | `False` |
| SQL pool | All listable GB vendors (no type/city SQL filter) |
| `primary_types`, `keywords` | empty |
| Ranking | `_rank_candidates` — everyone tends to `exact` tier |
| Response | `search_mode: "simple"`, 6 vendors, `total_count` = all listable |
| UI | Flat grid + pagination if total > 6 |

### Scenario B — Simple hunt: photographers in Leeds

**URL:** `/client/browse?q=photographers+in+Leeds`

| Step | What happens |
|------|----------------|
| API | `q=photographers in Leeds`, `limit=6` |
| LLM parse | `mode=simple`, `types=[photography]`, `location=Leeds`, keywords… |
| `plan_mode` | `False` |
| SQL | `city_query="Leeds"` → `ilike` on `base_city_normalized`; **no** type filter in SQL (chips empty) |
| `primary_types` | `["photography"]` from parsed types |
| Ranking | `_rank_candidates` — photographers in Leeds score highest; others may be `related`/`fallback` |
| UI | Simple grid; may show “Also consider” for related tiers |

If OpenAI fails: token-only keywords `["photographers", "in", "leeds"]`, no `types`, no SQL city from parser — weaker matches via text haystack only.

### Scenario C — Plan: help me plan my birthday

**URL:** `/client/browse?q=help+me+plan+my+birthday`

| Step | What happens |
|------|----------------|
| LLM parse | `mode=plan`, `needs` = cake (baking), food (catering), photos (photography optional) |
| `plan_mode` | `True` |
| SQL pool | Full listable set (no chip types) |
| Ranking | `_search_plan_sections` — 3 sections, up to 8 vendors each |
| Response | `search_mode: "plan"`, `plan`, `sections[]` |
| UI | `isPlanMode=true` — section headings, checklist chips, no pagination |

If OpenAI fails: falls back to simple keyword search for “help”, “me”, “plan”, “my”, “birthday” — **no plan UI**.

---

## 12. Function call order (cheat sheet)

```
GET /api/v1/vendors/explore/search
  explore.get_explore_vendors_search()
    search_approved_vendors()
      [if q] parse_marketplace_query()
        _parse_with_llm() OR cache hit
          parse_completion() → _sanitize_parse_result()
          OR _token_only_parse()
      list_approved_vendors_for_explore()
        apply_public_listing_filters()
        get_db().table("vendors")...
      [if plan_mode] _search_plan_sections()
        _rank_candidates() × N needs
          merge_review_stats_into_vendor_rows()
          merge_public_metrics_into_vendor_rows()
      [else] _rank_candidates()
        merge_review_stats_into_vendor_rows()
        merge_public_metrics_into_vendor_rows()
```

---

## 13. Files to open when debugging

| Symptom | Open first |
|---------|------------|
| Wrong URL params | `marketplaceSearchParams.ts`, `clientExploreApi.ts` |
| Parser wrong / no plan | `search_ai.py`, OpenAI logs |
| Vendor missing entirely | `visibility.py`, `moderation.py` |
| Wrong order / tiers | `search.py` → `_rank_candidates` |
| Plan sections empty | `search.py` → `_search_plan_sections`, LLM `needs` |
| UI shows wrong mode | `MarketplaceExploreView.tsx` (`isPlanMode`) |

---

## Related lessons

- `slice-2-client-browse.md` — routes and layout
- `slice-2-client-browse-e2e.md` — full file index and code excerpts
