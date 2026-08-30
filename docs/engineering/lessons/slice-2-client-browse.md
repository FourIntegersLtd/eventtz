# Slice 2 — Client browse: explore list + vendor profile (read-only)

**Walkthrough:** `slice-2-browse-flow-walkthrough.md` — traces every function call with three scenarios (bare browse, keyword search, plan mode).

### User story

Anyone (guest or signed-in client) opens `/client/browse` to search approved vendors, filter by category/location/dates/budget, optionally use device location for proximity sorting, then opens `/client/browse/[userId]` to read a vendor’s public profile — without logging in. Signed-in clients see the same pages inside the client portal sidebar and can multi-select vendors to message together (enquire is Slice 3a).

---

## What changed since last lesson

| Area | Before | Now |
|------|--------|-----|
| Browse list UI | `MarketplaceExploreView` owned fetch + state | **Thin view** — composes UI; logic in `useMarketplaceExplore.ts` |
| Geolocation | Manual city entry only | **`useBrowseGeolocation.ts`** — browser GPS → reverse geocode → sets `location` + `proximity` sort |
| Filters | Inline in explore view | **`MarketplaceFiltersBar.tsx`** + **`MarketplaceCategoryFilterFields.tsx`** (drawer) |
| Hero search | Monolithic | **`HeroMarketplaceSearch.tsx`** refactored; shares category/date field components |
| Date picker | Mixed into hero | **`MarketplaceDateFilterFields.tsx`** (hero dropdown + reusable) |
| Backend pool | Approved vendors only | **`deleted_user_ids`** excludes GDPR-tombstoned accounts from explore |
| Backend ranking | Text/location match | **`search.py`** — location bonus in `_relevance_score`; `sort=proximity` supported |
| Unchanged gates | — | **`visibility.py`**, **`moderation.py`**, **`search_ai.py`** still own listing + AI parse |

Plain English: browse is still public read, but the frontend is split into focused hooks/components, and the backend hides deleted users while ranking location-aware results.

---

## URLs

| URL | Page file | What the user sees |
|-----|-----------|-------------------|
| `/client/browse` | `frontend/app/client/(portal)/browse/page.tsx` | Hero search + filters bar + vendor card grid |
| `/client/browse/[userId]` | `frontend/app/client/(portal)/browse/[userId]/page.tsx` | One vendor’s profile (gallery, packages, reviews) |
| `/explore` | redirect in `next.config.ts` | Same as `/client/browse` (query preserved) |

Booking (“Request booking”) is Slice 3a; this slice covers discovery and read-only profile.

---

## Complete route (bookmark this chain)

### Browse list (`GET /vendors/explore/search`)

1. `frontend/app/client/(portal)/browse/page.tsx` — route `/client/browse`
2. `frontend/features/marketplace/MarketplaceExploreView.tsx` — thin UI shell
3. `frontend/features/marketplace/useMarketplaceExplore.ts` — URL state, fetch, selection, analytics
4. `frontend/features/marketplace/useBrowseGeolocation.ts` — GPS → city label → filter commit
5. `frontend/features/marketplace/HeroMarketplaceSearch.tsx` — query + date hero form
6. `frontend/features/marketplace/MarketplaceFiltersBar.tsx` — Filters drawer + Sort menu
7. `frontend/features/marketplace/MarketplaceCategoryFilterFields.tsx` — category checkboxes
8. `frontend/features/marketplace/MarketplaceDateFilterFields.tsx` — date chips (hero)
9. `frontend/lib/marketplaceSearchParams.ts` — URL query ↔ `MarketplaceSearchState`
10. `frontend/lib/clientExploreApi.ts` — `fetchExploreVendorsSearch`
11. `frontend/lib/axios.ts` — shared HTTP client (`withCredentials`; route is still public)
12. `backend/app/http/router.py` — mounts explore router
13. `backend/app/features/vendors/http/explore.py` — `GET /explore/search`
14. `backend/app/contracts/vendor.py` — `ExploreVendorSearchResponse`, `ExploreVendorSearchRow`
15. `backend/app/features/vendors/search.py` — `search_approved_vendors` (ranking, proximity sort)
16. `backend/app/features/vendors/search_ai.py` — `parse_marketplace_query` (when `q` non-empty)
17. `backend/app/features/vendors/moderation.py` — `list_approved_vendors_for_explore` + `deleted_user_ids`
18. `backend/app/features/vendors/visibility.py` — `apply_public_listing_filters`
19. `backend/app/core/db.py` — `get_db()` → Supabase `vendors` + `users`

### Vendor detail (`GET /vendors/explore/vendor/{id}`)

1. `frontend/app/client/(portal)/browse/[userId]/page.tsx`
2. `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx` — orchestration
3. `frontend/features/client/browse/useExploreVendor.ts` — loads one vendor
4. `frontend/lib/clientExploreApi.ts` — `fetchExploreVendorById`
5. `backend/app/features/vendors/http/explore.py` — `GET /explore/vendor/{vendor_user_id}`
6. `backend/app/features/vendors/moderation.py` — `get_approved_vendor_for_explore_by_id` + tombstone check
7. `backend/app/features/bookings/reviews.py` — `merge_review_stats_into_vendor_rows`
8. `backend/app/features/vendors/public_metrics.py` — completed bookings, response time, conversion

### Layout (who gets portal chrome?)

1. `frontend/app/client/(portal)/layout.tsx` — browse paths use special branch
2. `frontend/features/client/browse/ClientBrowsePortalLayout.tsx` — clients → `PortalShell`; guests → public chrome

---

## Example: guest searches, then opens a vendor

1. Guest visits `/client/browse?q=wedding+photography&location=London`.
2. `useMarketplaceExplore` reads query params → calls `fetchExploreVendorsSearch`.
3. Backend returns only **approved + publicly listable** vendors (deleted accounts excluded).
4. Guest clicks a card → `/client/browse/abc-uuid?...` (search params kept on the URL).
5. `useExploreVendor` calls `fetchExploreVendorById` — one row, not the full list.
6. `VendorBrowseDetailBody` renders profile read-only; “Request booking” prompts login for guests.

---

## Step 1 — URL lands on the browse page

**File:** `frontend/app/client/(portal)/browse/page.tsx`

```8:11:frontend/app/client/(portal)/browse/page.tsx
function ClientBrowsePageContent() {
  const { user } = useAuth();
  return <MarketplaceExploreView embedded={user?.user_type === "client"} />;
}
```

| Piece | Role |
|--------|------|
| `embedded` | When `true`, list UI drops extra marketing chrome (client already inside portal) |
| `MarketplaceExploreView` | Composes hero, filters, grid — delegates state to `useMarketplaceExplore` |

---

## Step 2 — Thin view + explore hook

**File:** `MarketplaceExploreView.tsx` — no fetch logic here anymore:

```58:100:frontend/features/marketplace/MarketplaceExploreView.tsx
  const { showToast } = useToast();
  const explore = useMarketplaceExplore(mode);
  const {
    pathname,
    router,
    state,
    fetchKey,
    loading,
    error,
    plan,
    sections,
    selectedVendors,
    selectedCount,
    clearSelection,
    multiEnquireOpen,
    setMultiEnquireOpen,
    isSaved,
    toggle,
    savedOnly,
    searchPrefill,
    planEventPrefill,
    multiEnquireContext,
    commitFilters,
    onVendorNavigate,
    openMultiEnquire,
    goToPage,
    headline,
    isPlanMode,
    visibleCards,
    displayCount,
    exactCards,
    alsoConsiderCards,
    cardSelectProps,
    launchingSoonModal,
    totalCount,
    matchNotice,
  } = explore;

  const geo = useBrowseGeolocation({
    state,
    onCommit: commitFilters,
    enabled: !savedOnly && mode === "browse",
  });
```

**File:** `useMarketplaceExplore.ts` — reads URL, fetches on param change:

```35:36:frontend/features/marketplace/useMarketplaceExplore.ts
  const state = useMemo(() => marketplaceStateFromSearchParams(sp), [sp]);
  const fetchKey = sp.toString();
```

```96:111:frontend/features/marketplace/useMarketplaceExplore.ts
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
```

Filter commits update the URL (and reset page to 1 via `buildMarketplaceSearchUrl`):

```243:251:frontend/features/marketplace/useMarketplaceExplore.ts
  const commitFilters = useCallback(
    (next: MarketplaceSearchState) => {
      track(MixpanelEvents.marketplace_filters_applied, {
        has_budget: next.budgetMin != null || next.budgetMax != null,
        sort: next.sort,
      });
      commit(next);
    },
    [commit],
  );
```

Plan mode activates when the API returns sections:

```177:177:frontend/features/marketplace/useMarketplaceExplore.ts
  const isPlanMode = searchMode === "plan" && sections.length > 0 && !savedOnly;
```

---

## Step 3 — Portal layout: public browse vs signed-in client

Most client portal pages require auth. Browse is the exception.

**File:** `frontend/app/client/(portal)/layout.tsx`

```15:21:frontend/app/client/(portal)/layout.tsx
  const isBrowse = pathname.startsWith("/client/browse");

  if (isBrowse) {
    return (
      <ClientBrowsePortalLayout pathname={pathname}>{children}</ClientBrowsePortalLayout>
    );
  }
```

**File:** `ClientBrowsePortalLayout.tsx`

```22:32:frontend/features/client/browse/ClientBrowsePortalLayout.tsx
export function ClientBrowsePortalLayout({ pathname, children }: ClientBrowsePortalLayoutProps) {
  const { user, loading } = useAuth();
  const isClient = user?.user_type === "client";

  if (loading) {
    return <LoadingState label="Loading browse…" variant="centered" branded />;
  }

  if (!isClient) {
    return <>{children}</>;
  }
```

Plain English: **Guests and vendors** see browse without the client sidebar. **Clients** get `PortalShell portal="client"`. Auth is not required to *view* — only for booking, chat, bookmarks.

---

## Step 4 — Hero search + filter bar

**Hero** — free-text query and optional dates; submits to URL:

```134:158:frontend/features/marketplace/HeroMarketplaceSearch.tsx
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasCriteria =
      state.query.trim().length > 0 ||
      state.location.trim().length > 0 ||
      state.types.length > 0 ||
      state.dates.length > 0 ||
      state.dateFlexible ||
      state.budgetMin != null ||
      state.budgetMax != null;
    if (!hasCriteria) return;
    track(MixpanelEvents.marketplace_search_submitted, {
      source: landing ? "landing" : "browse",
      has_query: state.query.trim().length > 0,
      has_location: state.location.trim().length > 0,
      type_count: state.types.length,
      date_count: state.dates.length,
      date_flexible: state.dateFlexible,
      has_budget: state.budgetMin != null || state.budgetMax != null,
    });
    const url = buildMarketplaceSearchUrl(submitToPath, { ...state, page: 1 });

    if (submitMode === "replace") router.replace(url);
    else router.push(url);
  };
```

On the browse page, `MarketplaceExploreView` mounts hero with `showTypesField={false}` (categories live in the Filters drawer) and `showDatesField`:

```137:155:frontend/features/marketplace/MarketplaceExploreView.tsx
      <HeroMarketplaceSearch
        key={fetchKey}
        variant="default"
        submitToPath={savedOnly ? "/client/favorites" : pathname}
        initialState={state}
        submitMode="replace"
        showTypesField={false}
        showDatesField
      />

      {!savedOnly ? (
        <MarketplaceFiltersBar
          state={state}
          onCommit={commitFilters}
          onRequestCurrentLocation={geo.requestCurrentLocation}
          geoLoading={geo.loading}
          geoError={geo.error}
          onClearGeoError={geo.clearError}
        />
      ) : null}
```

**Filters drawer** — category, location (with “Use current location”), budget, sort:

```30:36:frontend/features/marketplace/MarketplaceFiltersBar.tsx
const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "proximity", label: "Proximity" },
  { value: "rating", label: "Rating" },
];
```

Category checkboxes are shared with the landing hero via `MarketplaceCategoryFilterFields`:

```26:31:frontend/features/marketplace/MarketplaceCategoryFilterFields.tsx
export function MarketplaceCategoryFilterFields({
  types,
  onToggleType,
  showOtherOption = false,
}: MarketplaceCategoryFilterFieldsProps) {
  const options = showOtherOption ? SERVICE_OPTIONS : BROWSE_CATEGORY_OPTIONS;
```

Date picking in the hero uses `MarketplaceDateFilterFields` (flexible dates toggle, up to 3 dates).

---

## Step 5 — Device geolocation → proximity sort

**File:** `useBrowseGeolocation.ts`

```21:30:frontend/features/marketplace/useBrowseGeolocation.ts
  const applyLocation = useCallback(
    (location: string) => {
      onCommit({
        ...state,
        location,
        sort: state.sort === "relevance" ? "proximity" : state.sort,
        page: 1,
      });
    },
    [onCommit, state],
  );
```

```44:61:frontend/features/marketplace/useBrowseGeolocation.ts
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
        );
      });

      const label = await reverseGeocodeLocation(coords.latitude, coords.longitude, {
        countryCode: state.country,
      });
      if (!label) {
        setError("Could not determine your city from your location.");
        return null;
      }

      applyLocation(label);
      return label;
```

Flow: browser GPS → Photon reverse geocode (`photonLocationAutocomplete.ts`) → city string in URL `location` → API `sort=proximity` when user was on default relevance.

---

## Step 6 — Search state lives in the URL

Filters (query, types, location, dates, budget, sort, page) are encoded in query params so refresh and “back” work.

**File:** `frontend/lib/marketplaceSearchParams.ts`

- `marketplaceStateFromSearchParams(searchParams)` — read URL → `MarketplaceSearchState`
- `buildMarketplaceSearchUrl(path, state)` — write state → URL
- `buildClientBrowseVendorUrl(vendorUserId, state)` — detail link keeps filters
- `MARKETPLACE_PAGE_SIZE = 6`

When `search_mode === "plan"`, the API also returns `plan` + `sections` (AI-style multi-need breakdown). Simple text search uses `search_mode === "simple"`.

---

## Step 7 — Frontend API layer

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

Note the **90s in-tab cache** on search results — going back from detail avoids a duplicate search request.

`fetchExploreVendorById` hits `/api/v1/vendors/explore/vendor/{id}` and treats 404 as “not listed”.

---

## Step 8 — Backend HTTP: no auth guards

**File:** `backend/app/features/vendors/http/explore.py`

```96:130:backend/app/features/vendors/http/explore.py
@router.get("/explore/search", response_model=ExploreVendorSearchResponse)
def get_explore_vendors_search(
    types: str | None = Query(None, description="Comma-separated service keys (e.g. photography,catering)."),
    location: str | None = Query(None, description="Substring match against city, name, services."),
    q: str | None = Query(None, description="Free-text search (vendor name, city, services)."),
    dates: str | None = Query(None, description="Comma-separated ISO dates (max 3); availability filter later."),
    flexible: bool = Query(False, description="When true, date selection is not used for filtering (reserved)."),
    budget_min: float | None = Query(None, ge=0),
    budget_max: float | None = Query(None, ge=0),
    sort: str = Query(
        "relevance",
        description="relevance | price_asc | price_desc | proximity | rating",
    ),
    vendor_ids: str | None = Query(
        None,
        description="Comma-separated vendor user IDs - restrict search (e.g. favorites).",
    ),
    country: str | None = Query(None, description="ISO country code (default GB)."),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ExploreVendorSearchResponse:
    result = search_approved_vendors(
        types=types,
        location=location,
        q=q,
        dates=dates,
        flexible=flexible,
        budget_min=budget_min,
        budget_max=budget_max,
        sort=sort,
        vendor_user_ids=_parse_vendor_ids(vendor_ids),
        country=country,
        limit=limit,
        offset=offset,
    )
```

Router prefix is `/vendors`, registered in `backend/app/http/router.py` under `/api/v1`. No `require_user` — marketplace is public read.

---

## Step 9 — Free-text `q` → LLM parser (`search_ai.py`)

When the browse URL has a non-empty `q`, `search_approved_vendors` calls `parse_marketplace_query` before ranking.

**File:** `backend/app/features/vendors/search_ai.py`

| Outcome | What happens |
|---------|----------------|
| `q` empty | Parser not called; browse uses URL chips (`types`, `location`) and `_rank_candidates` on the full pool |
| OpenAI OK | `parse_completion` → `_LlmMarketplaceParse` → `_sanitize_parse_result` |
| OpenAI missing or error | `_token_only_parse` — split `q` into keyword tokens only; `mode` stays `simple`; no types, no plan |

```394:418:backend/app/features/vendors/search_ai.py
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
```

**Simple vs plan** (decided by the LLM, not regex):

- **simple** — one vendor hunt (“photographers in Leeds”). `search.py` runs `_rank_candidates`.
- **plan** — event checklist (“help me plan my birthday”). `search.py` runs `_search_plan_sections` with `parsed.needs`.

---

## Step 10 — Who appears in explore? (visibility + deleted users)

**File:** `backend/app/features/vendors/visibility.py`

```43:49:backend/app/features/vendors/visibility.py
def apply_public_listing_filters(query: Any) -> Any:
    """Narrow a `vendors` query to rows that may appear publicly."""
    return (
        query.eq("approval_status", "approved")
        .neq("listing_override", "hidden")
        .or_(f"listing_override.eq.visible,and({_STRIPE_READY_FILTER})")
    )
```

Plain English: a vendor must be **admin-approved**. Then either Stripe Connect is ready, **or** admin set `listing_override = visible`. `listing_override = hidden` removes them from browse even if approved.

**File:** `backend/app/features/vendors/moderation.py` — after SQL fetch, tombstoned users are dropped:

```608:633:backend/app/features/vendors/moderation.py
    data = getattr(res, "data", None) or []
    user_ids = [str(row.get("user_id")) for row in data if isinstance(row, dict) and row.get("user_id")]
    gone = deleted_user_ids(user_ids)
    emails_by_id: dict[str, str | None] = {}
    if user_ids:
        try:
            ures = get_db().table("users").select("id,email").in_("id", user_ids).execute()
            ...
    out: list[dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("user_id") or "")
        if uid in gone:
            continue
        out.append(
```

Detail lookup also checks `is_deleted_user_id` before returning a row.

---

## Step 11 — Location-aware ranking (`search.py`)

**SQL city filter** — `list_approved_vendors_for_explore` applies `ilike` on `base_city_normalized` when `city_query` is set.

**In-memory location scoring** — `_location_bonus` and `primary_loc_hit` boost vendors whose `baseCity` matches the filter:

```191:201:backend/app/features/vendors/search.py
def _location_bonus(location: str, base_city: str, related_locations: list[str]) -> float:
    loc = location.strip().lower()
    city = base_city.strip().lower()
    if loc and city:
        if loc in city or city in loc:
            return 2.0
    for related in related_locations:
        r = related.strip().lower()
        if r and city and (r in city or city in r):
            return 1.0
    return 0.0
```

**Sort options** include `proximity` (used after geolocation sets a city):

```462:477:backend/app/features/vendors/search.py
    def sort_key_fn(r: dict[str, Any]) -> tuple[Any, ...]:
        tier = _TIER_RANK.get(str(r.get("match_tier") or "exact"), 0)
        mp = r.get("_min_price")
        ts = float(r.get("_ts") or 0)
        sc = float(r.get("_score") or 0)
        if sort_key == "price_asc":
            return (tier, mp is None, mp if mp is not None else 1e18, -ts)
        if sort_key == "price_desc":
            return (tier, mp is None, -(mp if mp is not None else 0), -ts)
        if sort_key == "proximity":
            return (tier, -ts)
        if sort_key == "rating":
            avg = float(r.get("review_average") or 0)
            cnt = int(r.get("review_count") or 0)
            return (tier, -avg, -cnt, -ts)
        return (tier, -sc, -ts)
```

Plain English: location matching happens during tiering and relevance scoring; `proximity` sort re-orders within tiers (location-matched vendors tend to land in `exact` tier first).

---

## Step 12 — Vendor detail page (read-only body)

**File:** `ClientVendorBrowseDetailView.tsx`

```44:45:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const { user, loading: authLoading } = useAuth();
  const { vendor, loading, error, notFound } = useExploreVendor(userId);
```

```67:71:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const browseListHref = useMemo(
    () => buildMarketplaceSearchUrl("/client/browse", marketplaceSearch),
    [marketplaceSearch],
  );
```

- **Back link** restores list filters via URL.
- **Mismatch banner** if you opened a vendor who doesn’t match current search filters (deep link) — still viewable.
- `VendorBrowseDetailBody` — gallery, services, pricing display, reviews section.
- `onRequestBooking` only wired for `user_type === "client"` → opens `VendorBookingModal` (Slice 3a).

**File:** `useExploreVendor.ts` — thin hook around `fetchExploreVendorById`.

---

## Full chain (one picture)

```
Guest or client opens /client/browse?q=...
  ↓
client/(portal)/layout → ClientBrowsePortalLayout (portal shell if client)
  ↓
MarketplaceExploreView → useMarketplaceExplore
  ↓
marketplaceSearchParams ↔ HeroMarketplaceSearch + MarketplaceFiltersBar
  ↓
fetchExploreVendorsSearch → GET /api/v1/vendors/explore/search
  ↓
explore.py → search_approved_vendors
    → (search_ai if q) → moderation + visibility + deleted_user_ids
    → _rank_candidates OR _search_plan_sections
  ↓
JSON ExploreVendorSearchRow[] → MarketplaceVendorCard grid

User clicks vendor card
  ↓
/client/browse/{userId}?... (search params preserved)
  ↓
useExploreVendor → fetchExploreVendorById → GET /explore/vendor/{id}
  ↓
get_approved_vendor_for_explore_by_id + review/metric merges
  ↓
VendorBrowseDetailBody (read-only profile)
```

---

## Key concepts from this slice

- **Public listing gate** — approved + (Stripe ready OR admin `visible` override) and not `hidden`.
- **Deleted user exclusion** — `deleted_user_ids` removes GDPR tombstones from explore results.
- **Thin view + hook** — `MarketplaceExploreView` renders; `useMarketplaceExplore` owns fetch/state.
- **Geolocation handoff** — GPS → reverse geocode → URL `location` + optional `proximity` sort.
- **Filter components** — `MarketplaceFiltersBar`, `MarketplaceCategoryFilterFields`, `MarketplaceDateFilterFields`.
- **Explore vs explore/search** — full dump vs filtered/ranked search (UI uses search).
- **profile_form_data** — vendor marketing copy and packages from `vendors.payload` JSON.
- **Embedded browse** — same marketplace component, different chrome for portal vs public.
- **Search context on URLs** — filters survive navigation to detail and back.
- **LLM-only parse** — `search_ai.py` decides simple vs plan; token-only fallback is keywords, not canned checklists.

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Vendor missing from browse but “approved” in admin | `backend/app/features/vendors/visibility.py` (Stripe / `listing_override`) |
| Approved vendor still listed after account deletion | `moderation.py` → `deleted_user_ids` / `is_deleted_user_id` |
| Empty search results | `backend/app/features/vendors/search.py` then `search_ai.py` if `q` set |
| Plan mode never appears | `search_ai.py` — OpenAI must succeed; check logs for LLM parse failures |
| Proximity sort does nothing useful | `useBrowseGeolocation.ts` (permission/denied) + `search.py` (`location_filter`, `sort=proximity`) |
| Geolocation sets wrong city | `photonLocationAutocomplete.ts` reverse geocode + `state.country` |
| 404 on detail | `moderation.py` → `get_approved_vendor_for_explore_by_id` |
| Filters lost when going back | `frontend/lib/marketplaceSearchParams.ts` |
| Client sees marketing chrome instead of sidebar | `ClientBrowsePortalLayout.tsx` + `/me` `user_type` |
| API 401 on browse | Wrong — explore has no guard; check axios base URL / proxy |
| Fetch never runs / stale grid | `useMarketplaceExplore.ts` `useEffect` deps (`fetchKey`, `state`) |

---

## TL;DR

- **`/client/browse`** = `MarketplaceExploreView` + `useMarketplaceExplore` → `GET /vendors/explore/search`.
- **`/client/browse/[userId]`** = one vendor → `GET /vendors/explore/vendor/{id}`.
- **No login required** to browse; **clients** get portal sidebar via `ClientBrowsePortalLayout`.
- **Filters** — hero search + `MarketplaceFiltersBar`; geolocation via `useBrowseGeolocation`.
- **Visibility** in `visibility.py` + **deleted users** in `moderation.py` decide who is listable.
- **Booking** buttons exist on detail but the enquire flow is **Slice 3a**.

Next slice: **Client booking — enquire** (`VendorBookingModal` → `POST` booking create).

---

## Related lessons

- Slice 1: `slice-1-auth-me.md`
- Walkthrough: `slice-2-browse-flow-walkthrough.md`
- Slice 3a: `slice-3a-client-booking-enquire.md`
