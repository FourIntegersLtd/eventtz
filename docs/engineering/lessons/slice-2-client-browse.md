# Slice 2 — Client browse: explore list + vendor profile (read-only)

**Deep dive:** If the flow still feels fuzzy, read `slice-2-browse-flow-walkthrough.md` first — it traces every function call with three scenarios.

### User story
Anyone (guest or signed-in client) opens `/client/browse` to search approved vendors, then opens `/client/browse/[userId]` to read a vendor’s public profile — without logging in. Signed-in clients see the same pages inside the client portal sidebar.

---

## What those two URLs mean

| URL | Page file | What the user sees |
|-----|-----------|-------------------|
| `/client/browse` | `frontend/app/client/(portal)/browse/page.tsx` | Search + grid of vendor cards |
| `/client/browse/[userId]` | `frontend/app/client/(portal)/browse/[userId]/page.tsx` | One vendor’s profile (gallery, packages, reviews) |
| `/explore` | redirect in `next.config.ts` | Same as `/client/browse` (query preserved) |

Plain English: **browse** is the marketplace discovery slice. Listing and detail are **public API routes** — no session cookie required. Booking (“enquire”) is Slice 3; we only point at the buttons here.

---

## Complete route (bookmark this chain)

### Browse list (`GET /vendors/explore/search`)

1. `frontend/app/client/(portal)/browse/page.tsx`
2. `frontend/features/marketplace/MarketplaceExploreView.tsx`
3. `frontend/lib/marketplaceSearchParams.ts` — URL query ↔ filter state
4. `frontend/lib/clientExploreApi.ts` — `fetchExploreVendorsSearch`
5. `frontend/lib/axios.ts` — shared HTTP client (`withCredentials` still works; route is public)
6. `backend/app/http/router.py` — mounts explore router
7. `backend/app/features/vendors/http/explore.py` — `GET /explore/search`
8. `backend/app/contracts/vendor.py` — `ExploreVendorSearchResponse`, `ExploreVendorSearchRow`
9. `backend/app/features/vendors/search.py` — `search_approved_vendors`
10. `backend/app/features/vendors/search_ai.py` — `parse_marketplace_query` (when `q` non-empty)
11. `backend/app/features/vendors/moderation.py` — `list_approved_vendors_for_explore` (base pool)
12. `backend/app/features/vendors/visibility.py` — `apply_public_listing_filters`
13. `backend/app/core/db.py` — `get_db()` → Supabase `vendors` + `users`

### Vendor detail (`GET /vendors/explore/vendor/{id}`)

1. `frontend/app/client/(portal)/browse/[userId]/page.tsx`
2. `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx`
3. `frontend/features/client/browse/useExploreVendor.ts`
4. `frontend/lib/clientExploreApi.ts` — `fetchExploreVendorById`
5. `backend/app/features/vendors/http/explore.py` — `GET /explore/vendor/{vendor_user_id}`
6. `backend/app/features/vendors/moderation.py` — `get_approved_vendor_for_explore_by_id`
7. `backend/app/features/bookings/reviews.py` — `merge_review_stats_into_vendor_rows`
8. `backend/app/features/vendors/public_metrics.py` — completed bookings, response time, conversion

### Layout (who gets portal chrome?)

1. `frontend/app/client/(portal)/layout.tsx` — browse paths use special branch
2. `frontend/features/client/browse/ClientBrowsePortalLayout.tsx` — clients → `PortalShell`; guests → public chrome from page components

---

## Example: guest searches, then opens a vendor

1. Guest visits `/client/browse?q=wedding+photography&location=London`.
2. `MarketplaceExploreView` reads query params → calls `fetchExploreVendorsSearch`.
3. Backend returns only **approved + publicly listable** vendors matching the query.
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
| `MarketplaceExploreView` | Shared marketplace UI (also used for favorites mode elsewhere) |

---

## Step 2 — Portal layout: public browse vs signed-in client

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

**File:** `frontend/features/client/browse/ClientBrowsePortalLayout.tsx`

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

Plain English: **Guests and vendors** see browse without the client sidebar. **Clients** get `PortalShell portal="client"` so browse feels like dashboard/bookings. Auth is not required to *view* — only for actions (booking, chat).

---

## Step 3 — Search state lives in the URL

Filters (query, types, dates, budget, sort, page) are encoded in query params so refresh and “back” work.

**File:** `frontend/lib/marketplaceSearchParams.ts`

- `marketplaceStateFromSearchParams(searchParams)` — read URL → `MarketplaceSearchState`
- `buildMarketplaceSearchUrl(path, state)` — write state → URL
- `buildClientBrowseVendorUrl(vendorUserId, state)` — detail link keeps filters

**File:** `frontend/features/marketplace/MarketplaceExploreView.tsx` (fetch on param change)

```147:161:frontend/features/marketplace/MarketplaceExploreView.tsx
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

When `search_mode === "plan"`, the API also returns `plan` + `sections` (AI-style multi-need breakdown). Simple text search uses `search_mode === "simple"`.

---

## Step 4 — Frontend API layer

**File:** `frontend/lib/clientExploreApi.ts`

Types mirror backend contracts (`ExploreVendor`, `ExploreVendorSearchRow`).

```138:170:frontend/lib/clientExploreApi.ts
export async function fetchExploreVendorsSearch(
  q: ExploreSearchQuery,
): Promise<ExploreVendorsSearchResult> {
  const sp = new URLSearchParams();
  const searchText = (q.query?.trim() || q.location?.trim()) ?? "";
  if (searchText) sp.set("q", searchText);
  // ... types, dates, budget, sort, pagination ...
  const url = qs
    ? `/api/v1/vendors/explore/search?${qs}`
    : "/api/v1/vendors/explore/search";
  const { data } = await api.get<ExploreVendorSearchApiResponse>(url);
```

Note the **90s in-tab cache** on search results — going back from detail avoids a duplicate search request.

`fetchExploreVendorById` hits `/api/v1/vendors/explore/vendor/{id}` and treats 404 as “not listed”.

There is also `fetchExploreVendors()` → `GET /vendors/explore` (full approved list). The main browse UI uses **search**, not that endpoint.

---

## Step 5 — Backend HTTP: no auth guards

**File:** `backend/app/features/vendors/http/explore.py`

```47:55:backend/app/features/vendors/http/explore.py
@router.get("/explore", response_model=ExploreVendorsResponse)
def get_explore_vendors(
    country: str | None = Query(None, description="ISO country code (default GB)."),
) -> ExploreVendorsResponse:
    rows = list_approved_vendors_for_explore(country_code=normalize_country_code(country))
    rows = merge_review_stats_into_vendor_rows(rows)
    rows = merge_public_metrics_into_vendor_rows(rows)
```

```108:128:backend/app/features/vendors/http/explore.py
@router.get("/explore/search", response_model=ExploreVendorSearchResponse)
def get_explore_vendors_search(
    types: str | None = Query(None, description="Comma-separated service keys (e.g. photography,catering)."),
    location: str | None = Query(None, description="Substring match against city, name, services."),
    q: str | None = Query(None, description="Free-text search (vendor name, city, services)."),
    # ... dates, budget, sort, pagination ...
) -> ExploreVendorSearchResponse:
    result = search_approved_vendors(
```

Router prefix is `/vendors` (see `router = APIRouter(prefix="/vendors")`), registered in `backend/app/http/router.py` under `/api/v1`. No `require_user` — marketplace is public read.

Detail route records `vendor_profile_viewed` analytics when found.

---

## Step 6 — Free-text `q` → LLM parser (`search_ai.py`)

When the browse URL has a non-empty `q` (or the frontend merges `query` + `location` into `q`), `search_approved_vendors` calls `parse_marketplace_query` before ranking.

**File:** `backend/app/features/vendors/search_ai.py`

The **LLM is the only query parser** for `mode`, service `types`, `location`, event `event_types`, and plan `needs`. Sanitize steps only clamp taxonomy, length, and duplicate catering needs — they do not invent a birthday checklist or map “baker” → `baking` when the model is skipped.

| Outcome | What happens |
|---------|----------------|
| `q` empty | Parser not called; browse uses URL chips (`types`, `location`) and `_rank_candidates` on the full pool |
| OpenAI OK | `parse_completion` → `_LlmMarketplaceParse` → `_sanitize_parse_result` |
| OpenAI missing or error | `_token_only_parse` — split `q` into keyword tokens only; `mode` stays `simple`; no types, no plan |

```380:404:backend/app/features/vendors/search_ai.py
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

Plain English: without OpenAI, “plan my wedding” still searches as loose keywords — it will **not** auto-build cake + catering sections. Plan mode requires a successful LLM parse.

---

## Step 7 — Who appears in explore? (visibility rule)

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

Plain English: a vendor must be **admin-approved**. Then either:
- Stripe Connect is ready (charges + payouts), **or**
- admin set `listing_override = visible` (waive Stripe gate).

`listing_override = hidden` removes them from browse even if approved.

**File:** `backend/app/features/vendors/moderation.py` — `list_approved_vendors_for_explore` applies those filters, optional country/budget/service/city filters, then joins emails from `users`.

Vendor profile body lives in `vendors.payload` (JSON) — exposed as `profile_form_data` in API responses.

---

## Step 8 — Contract shape (models, not SQL)

**File:** `backend/app/contracts/vendor.py`

```193:216:backend/app/contracts/vendor.py
class ExploreVendorRow(BaseModel):
    user_id: str
    email: str | None = None
    status: VendorProfileStatus | str = "draft"
    approval_status: VendorApprovalStatus | str
    profile_form_data: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias="payload",
    )
    updated_at: str | None = None
    review_average: float | None = None
    review_count: int = 0
    completed_bookings: int = Field(
        default=0,
        description="All-time completed bookings (public trust signal).",
    )
```

`ExploreVendorSearchRow` adds `matched_services`, `match_tier`, optional `featured_review`.

Frontend twin: `ExploreVendor` in `frontend/lib/clientExploreApi.ts`.

---

## Step 9 — Vendor detail page (read-only body)

**File:** `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx`

```38:39:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const { user, loading: authLoading } = useAuth();
  const { vendor, loading, error, notFound } = useExploreVendor(userId);
```

```52:55:frontend/features/client/browse/ClientVendorBrowseDetailView.tsx
  const browseListHref = useMemo(
    () => buildMarketplaceSearchUrl("/client/browse", marketplaceSearch),
    [marketplaceSearch],
  );
```

- **Back link** restores list filters via URL.
- **Mismatch banner** if you opened a vendor who doesn’t match current search filters (deep link) — still viewable.
- `VendorBrowseDetailBody` — gallery, services, pricing display, reviews section.
- `onRequestBooking` only wired for `user_type === "client"` → opens `VendorBookingModal` (Slice 3a).

**File:** `frontend/features/client/browse/useExploreVendor.ts` — thin hook around `fetchExploreVendorById`.

---

## Full chain (one picture)

```
Guest or client opens /client/browse?q=...
  ↓
client/(portal)/layout → ClientBrowsePortalLayout (portal shell if client)
  ↓
MarketplaceExploreView reads marketplaceSearchParams
  ↓
fetchExploreVendorsSearch → GET /api/v1/vendors/explore/search
  ↓
explore.py → search_approved_vendors → (search_ai if q) → moderation + visibility filters
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

## Why public routes + client layout?

- **Public API:** Marketplace SEO and guest discovery; login only for actions.
- **Dual chrome:** Clients shouldn’t lose portal nav when browsing; guests shouldn’t be forced through `/login` to see listings.
- **Search not list:** `explore/search` supports filters, ranking, plan mode; plain `explore` is a simpler country-scoped dump.
- **Single-vendor endpoint:** Detail page doesn’t download every vendor just to show one profile.

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Vendor missing from browse but “approved” in admin | `backend/app/features/vendors/visibility.py` (Stripe / `listing_override`) |
| Empty search results | `backend/app/features/vendors/search.py` then `search_ai.py` if `q` set |
| Plan mode never appears | `search_ai.py` — OpenAI must succeed; check logs for LLM parse failures |
| 404 on detail | `moderation.py` → `get_approved_vendor_for_explore_by_id` |
| Filters lost when going back | `frontend/lib/marketplaceSearchParams.ts` |
| Client sees marketing chrome instead of sidebar | `ClientBrowsePortalLayout.tsx` + `/me` `user_type` |
| API 401 on browse | Wrong — explore has no guard; check axios base URL / proxy |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| Public explore + visibility module | **Leave it alone** — clear separation, Stripe gate prevents broken checkout |
| URL-driven search state | **Leave it alone** — shareable links, back button works |
| `fetchExploreVendors` vs search duplication | **Improve later** — two list endpoints; UI only needs search |
| 90s search cache in `clientExploreApi` | **Leave it alone** — small UX win; stale data window is short |
| Browse layout exception in client layout | **Leave it alone** — intentional product choice |

---

## Key concepts from this slice

- **Public listing gate** — approved + (Stripe ready OR admin `visible` override) and not `hidden`.
- **Explore vs explore/search** — full dump vs filtered/ranked search (UI uses search).
- **profile_form_data** — vendor marketing copy and packages from `vendors.payload` JSON.
- **Embedded browse** — same marketplace component, different chrome for portal vs public.
- **Search context on URLs** — filters survive navigation to detail and back.
- **LLM-only parse** — `search_ai.py` decides simple vs plan; token-only fallback is keywords, not canned checklists.

---

## TL;DR

- **`/client/browse`** = marketplace search UI → `GET /vendors/explore/search`.
- **`/client/browse/[userId]`** = one vendor → `GET /vendors/explore/vendor/{id}`.
- **No login required** to browse; **clients** get portal sidebar via `ClientBrowsePortalLayout`.
- **Visibility** in `visibility.py` decides who is listable, not just `approval_status`.
- **Booking** buttons exist on detail but the enquire flow is **Slice 3a**.

Next slice: **Client booking — enquire** (`VendorBookingModal` → `POST` booking create).
