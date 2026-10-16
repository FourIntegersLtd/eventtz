Task: fix-ups from review of 8f35108 (ws14 piece 12c) and 291a1ac (ws12 receipts freeze).
Reply in English. First read .qwen/ws14-common-rules.md; it applies in full. Work on
rebuild/osce-architecture in place, no branches. You are running alone. Three commits, in order.

## Commit 1 — web dev CSP (already edited, review and commit)
web/src/middleware.ts has an uncommitted change: `'unsafe-eval'` is added to script-src only
when NODE_ENV === "development". `next dev` evals its bundles, so without it no client JS runs
and every page stays on its first frame (why browse sat on "Loading browse…"). Production
keeps the strict policy. Check the diff is only that, then commit just that path:
"web: allow eval in the dev CSP so next dev hydrates (ws14)"

## Commit 2 — planner auto-select on browse (piece 12c gap)
Baseline: frontend/features/marketplace/useMarketplaceExplore.ts, the effect using
`plannerAutoSelectDone`. When browse is opened from the planner (`state.fromPlannerPlanId`
set and `state.vendorIds` non-empty), once the results for that URL arrive, every returned
vendor (from `vendors` and from every `sections[].vendors`) whose user_id is in
`state.vendorIds` is added to the selection, so "Message N together" is ready. It runs once
per URL (fetch key); a later deselect is not undone. Existing selections are kept.
- Put the matching in a pure function in marketplaceSelection.ts, e.g.
  `plannerPreselection(vendorIds, vendors, sections) → Record<id, row>`, and test it with
  node --test, asserting literal ids: matches from vendors and sections; ids not in results
  are skipped; no fromPlanner/vendorIds → empty.
- No setState in an effect body (common rules). Apply it where the fetch result is stored
  (the promise callback in useMarketplaceExplore), only when `isClient`, only for browse
  (not favorites).
Allowed paths: web/src/domains/marketplace/**. Commit:
"web: preselect planner vendors on browse, as on the baseline (ws14 piece 12c)"

## Commit 3 — receipts freeze gaps (acceptance/test_receipts.py only)
1. CHARGE_ID and TRANSFER_ID both end in 12345678, so the payout statement cannot tell
   transfer_reference from payment_reference. Give the transfer id a different last 8
   (e.g. tr_acceptance87654321 → "…87654321"), assert transfer_reference with it, and also
   assert payment_reference on the payout statement (charge suffix).
2. The baseline also issues vendor payment records for `refunded` and `partially_refunded`
   (backend/app/features/bookings/receipts.py RECEIPT_ELIGIBLE_STATUSES and
   `_vendor_payment_record_status_note`). Add one test per status asserting status 200,
   payment_status and the exact status_note the baseline returns (read it from the code,
   then confirm against :8000).
3. test_client_receipt_returns_the_frozen_snapshot inserts a placeholder snapshot and then
   overwrites it. Drop the placeholder from the insert; keep the update.
Servers already run on :8000 (baseline) and :8001 (api); do not restart them. From
acceptance/: `make test ARGS=test_receipts.py` must pass fully on the baseline, and
`make test TARGET=api ARGS=test_receipts.py` must be all xfailed with no XPASS. `make lint`
exits 0. Commit:
"acceptance: receipts freeze distinguishes transfer ref, covers refunds (ws12)"

## Browser check (now possible after commit 1)
Web is on :3001. Sign in as a local client (register one on :3001 with an @example.com
address; local data only, no Stripe). On /client/browse: tick "Add to message" on two
vendors, open "Message 2 together", send, and confirm you land on /client/bookings with
both requests listed. Then open a planner plan's "browse" link and confirm its vendors
arrive preselected. Say exactly which of these you did.

## Done means
From web/: `npm run ci` exits 0 (check the exit code). All commits use explicit paths
(`git commit -- <paths>`) and the trailer Co-Authored-By: Cursor Agent <noreply@cursor.com>.
Report in English, 12 lines or fewer: the three commit hashes, `# tests` / `# pass`, the
receipts counts on both targets, the two new status notes, and what you checked in the browser.
