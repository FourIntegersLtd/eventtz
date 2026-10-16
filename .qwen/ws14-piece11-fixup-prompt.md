Task: ws14 client portal, piece 11 FIX-UP (browse and favorites). Reply in English.
First read .qwen/ws14-common-rules.md; it applies in full. Mainline is 576e46f (your piece 11
commit). Work on it in place, no branches. You are running alone.

Review of 576e46f found the port incomplete. The baseline is the reference for every item:
frontend/features/marketplace/MarketplaceExploreView.tsx, useMarketplaceExplore.ts,
MarketplaceFiltersBar.tsx, and frontend/lib/marketplaceSearchParams(.test).ts.

## 1. BUG: an empty favorites list shows every vendor
useMarketplaceExplore: when favorites mode has no saved ids, favoriteVendorIds is undefined,
so the search runs unfiltered and /client/favorites lists the whole marketplace.
Baseline lines 83-92: if savedOnly && bookmarksReady && savedIds.size === 0, do NOT fetch;
show the empty state. Put the "which vendor ids / should we fetch at all" decision in a pure
.ts function and test it: favorites + no saved ids → no fetch; favorites + ids → those ids
only; browse + vendor_ids in URL → those; browse + none → unfiltered.

## 2. Loading goes stale on every filter or page change
`loading` starts true and is never set true again, so changing page or filters shows the
old results with no spinner. Use the derived-loading pattern from the common rules: store
the result together with the fetch key it answers; loading = no result for the current
key. No setState in the effect body except inside the promise callbacks.

## 3. Error copy
On a failed search show the baseline's fixed "Could not load vendors right now.", not the
thrown error's message.

## 4. Filters bar (in scope; it was left out)
Port MarketplaceFiltersBar.tsx as web/src/domains/marketplace/MarketplaceFiltersBar.tsx, shown
on browse only (baseline: `!savedOnly`). It must include: the search input (static
placeholder), category (wire the existing MarketplaceCategoryFilterFields +
useCategoryVendorCounts), location as a plain text input (no Photon / geolocation button),
dates + flexible (wire the existing MarketplaceDateFilterFields), budget min/max with the
baseline's validation rules and messages, sort, and a clear-filters control. Every change
goes through the hook's commit() → URL, resetting page to 1 like the baseline.
No new npm packages: no lucide-react (use text or inline SVG), no motion, no Drawer. On
small screens a simple show/hide toggle for the extra filters is enough. Use
foundation/ui (Button, TextField, Spinner, Card) only.
Delete the unused commitFilters / onVendorNavigate wrappers in the hook unless the bar uses them.

## 5. Plan mode and match notice (left out)
Port the baseline's plan-mode rendering: isPlanMode = searchMode === "plan" &&
sections.length > 0 && !savedOnly; the plan.needs chips linking to #plan-need-{id}; one
section per need using expandVendorsForSearchResults(section.vendors, [section.service_key]);
the "Want a full celebration plan…" → /client/planner?q=… link; no pagination in plan mode.
Render matchNotice where the baseline does. The "From your celebration plan" banner stays,
without the multi-select button (piece 12). The planner already links into browse with q,
vendor_ids and fromPlanner (web/src/domains/client-planner/plannerModel.ts); check that
link lands correctly.

## 6. Match the baseline's empty states and favorites layout
Titles/descriptions exactly: "No saved vendors yet" / "Tap the heart on a vendor card to save
them here." and "No vendors match these filters" / "Try widening your search or clearing a
filter." Favorites is one grid (no exact / also-consider split) plus pagination.

## 7. Tests (only 6 exist; the baseline file alone has 4)
- Port the two missing baseline cases in marketplaceSearchParams.test.ts (booking search
  prefill from marketplace dates; planner attribution on client search context). If the
  functions they test were not ported, port them.
- New node --test files for real logic: marketplaceSearchModel (headline, expand by type),
  the fetch-decision function from item 1, the pagination window, budget validation, and the
  pure part of the bookmark merge (move it into a .ts file if it lives in the hook).
Assert literal expected values.

## 8. Dead code
marketplacePlanCopy.ts has no importer: use it in plan mode or delete it. Keep
marketplaceVendorMatch.ts (the vendor detail page in piece 12 uses it). After your changes
every other file in domains/marketplace must have an importer.

## Allowed paths
web/src/app/client/(portal)/browse/page.tsx, web/src/app/client/(portal)/favorites/**,
web/src/domains/marketplace/**.

## Done means
types, eslint and node --test on your paths all exit 0. Run the `reviewer` subagent on your
diff and fix real findings. Commit with explicit paths:
"web: browse filters, plan mode, favorites fixes (ws14)"
trailer: Co-Authored-By: Cline <noreply@cline.bot>
Report in English, 12 lines or fewer, with exact counts from node --test (# tests / # pass)
and the list of anything still left out.
