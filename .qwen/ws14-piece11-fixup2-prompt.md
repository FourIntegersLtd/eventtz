Task: ws14 client portal, piece 11 FIX-UP 2 (browse filters bar). Reply in English.
First read .qwen/ws14-common-rules.md; it applies in full. Mainline is edd9ad3 (your fix-up
commit). Work on it in place, no branches. You are running alone.

Review of edd9ad3: the hook, plan mode, favorites and empty states are right. The filters
bar has three behaviour bugs. Baseline reference: frontend/features/marketplace/
MarketplaceFiltersBar.tsx and MarketplaceExploreView.tsx.

## 1. BUG: the whole bar remounts on every URL change
MarketplaceExploreView renders `<MarketplaceFiltersBar key={fetchKey} …>`. The baseline keys
only the hero search, never the filters bar. Because every filter change commits to the URL,
the remount (a) closes the mobile "More filters" panel after each category tick or date pick,
and (b) drops focus when a budget change commits and the user tabs to the next box.
Fix: remove the key. Keep the drafts (query, location, min, max) in sync with the URL
without remounting, using React's "adjust state when a prop changes" pattern during render:
store the last-seen URL value next to each draft; when `state.query` (etc.) differs from it,
reset that draft and the stored value. No useEffect for this, and no key on any sub-part.
extraOpen must survive commits. Drop `fetchKey` from the view's destructure if unused.

## 2. BUG: leaving a field resets to page 1 even when nothing changed
Location and budget commit on blur with `page: 1` unconditionally, so clicking into Location
and out again on page 3 jumps to page 1. Commit only when the value actually changed:
location when `locationDraft.trim() !== state.location.trim()`; budget when the validated
min/max differ from `state.budgetMin` / `state.budgetMax`. Validation errors still show on
blur as now.

## 3. Clear filters must match the baseline
Baseline `buildClearedState` clears types, location, budget and sort (page 1) and KEEPS
query and dates; its `activeFilterCount` counts types, location and budget only (not dates).
Make ours the same. Move `activeFilterCount` and the cleared-state builder into a pure
`marketplaceFilterState.ts` and test both with node --test, asserting literal values:
- count is 0 for dates-only / flexible-only state; 3 with types + location + budget;
- cleared state keeps `query` and `dates`/`dateFlexible`, clears the rest, page 1.
The bar resets its location and budget drafts after clearing (the query draft stays).

## 4. Small
- Planner banner: remove "or select several and message them together" (multi-select is
  piece 12, which restores the baseline wording). Text: "From your celebration plan — open a
  vendor to pick packages."
- MarketplacePagination.tsx: move the marketplacePaginationWindow import to the top.

## Allowed paths
web/src/domains/marketplace/**.

## Done means
From web/: `npm run ci` exits 0 (check the exit code). If you can run the app
(`npm run dev`, :3001, signed in as a client): at 375px width open More filters, tick a
category and confirm the panel stays open; type a min budget, tab to max and confirm focus
stays; on page 2, click into Location and out and confirm the page stays 2. Say which of
these you actually checked. Commit with explicit paths:
"web: filters bar keeps drafts, baseline clear (ws14)"
trailer: Co-Authored-By: Cursor Agent <noreply@cursor.com>
Report in English, 10 lines or fewer: exact `# tests` / `# pass` from the run, what you
checked in the browser, anything left out.
