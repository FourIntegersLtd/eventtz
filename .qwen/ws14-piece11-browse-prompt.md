Task: ws14 client portal, piece 11 (browse and favorites).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/browse and /client/favorites
Baseline: frontend/app/client/(portal)/browse/page.tsx and favorites/page.tsx, both →
frontend/features/marketplace/MarketplaceExploreView.tsx and its folder
(MarketplaceBrowseShell, MarketplaceFiltersBar, MarketplaceCategoryFilterFields,
MarketplaceDateFilterFields, MarketplacePagination, MarketplaceVendorCard,
marketplaceSearchModel.ts, marketplacePlanCopy.ts, useMarketplaceExplore.ts,
useMarketplaceBookmarks.ts, useCategoryVendorCounts.ts, useBrowseGeolocation.ts),
frontend/lib/clientExploreApi.ts, clientFavoritesApi.ts, marketplaceSearchParams.ts,
markets.ts, vendorMetrics.ts, vendorPortfolioImages.ts.
API: GET /api/v1/vendors/explore, GET /api/v1/vendors/explore/search,
GET/PUT/DELETE /api/v1/client/favorites(/{vendor_user_id}), POST /api/v1/client/favorites/merge.
This is the biggest search UI: plan it with the planner first. Filters, pagination and
sort live in the URL query exactly as in the baseline (marketplaceSearchParams.ts): port
that parsing/serialising as plain .ts with tests, plus marketplaceSearchModel.ts.
Favorites is the same view filtered to saved vendors; bookmark toggles work on both.
New domain: web/src/domains/marketplace (a later public explore page can reuse it).
Leave out: MultiVendorEnquireModal (booking requests come in piece 12), the rotating
placeholder, and the location autocomplete if it calls a third-party service from the
browser (useBrowseGeolocation / Photon): report what you left out.
Cards link to /client/browse/[userId] (piece 12).

## Allowed paths
web/src/app/client/(portal)/browse/page.tsx, web/src/app/client/(portal)/favorites/**,
web/src/domains/marketplace/**.
Commit: "web: client browse and favorites (ws14)"
