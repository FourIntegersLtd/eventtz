# Piece 03 — web: browse multi-select and "enquire several vendors" (money: no prices sent)

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on piece 02, which must be committed. You reuse its validation and payload builder.

## Goal
On `/client/browse`, a signed-in client can select several vendor cards, press the selection bar's action and send one shared brief to all of them. The brief picks one package per vendor.

Web has **no selection state today**: `selectedById`, `toggleSelect` and `clearSelection` don't exist in `web/src/domains/marketplace/`.

## Baseline files (read once)
- `frontend/features/marketplace/MultiVendorEnquireModal.tsx` (379 lines)
- `MultiVendorPackagePicker`: find it with `grep -rn "MultiVendorPackagePicker" frontend/features frontend/components`.
- `frontend/features/marketplace/useMarketplaceExplore.ts`:
  - line 48: `selectedById: Record<string, ExploreVendorSearchRow>`
  - line 68: `toggleSelect`
  - line 80: `clearSelection`
- `frontend/features/marketplace/MarketplaceExploreView.tsx`:
  - the selection bar with its "Clear" button, around line 125;
  - the modal mount, around line 365; `onSuccess` calls `clearSelection()`.
- `frontend/features/marketplace/MarketplaceVendorCard.tsx`: the select checkbox or toggle and its aria label.
- `frontend/lib/vendorAvailability.ts`: `vendorUserIdsWithCalendarConflict`, ported in piece 01.
- `frontend/features/bookings/bookingConfirmCopy.ts`, lines 150-160, for the copy:
  - `requestsNotSent` = "Requests not sent"
  - `partialRequestsSent(sent, total)` = "{sent} of {total} requests sent"

## Behaviour (match exactly)
- Selection only shows for a signed-in client, and only where the baseline shows it: check whether that is browse mode only or favorites too. Guests see no checkbox.
- The selection bar shows the count, the action button (use the baseline's label) and "Clear". The action opens the modal.
- The modal has the same fields as piece 02:
  - event name;
  - date;
  - end date;
  - venue address;
  - notes;
  - **one package per vendor**, chosen with the package picker. Per-unit options have a quantity stepper, clamped to their minimum.
- Validation: the same messages as piece 02. The calendar-conflict check lists or blocks the vendors whose availability doesn't allow the dates; use the baseline's exact wording.
- Submit posts `POST /api/v1/client/booking-requests` **once per vendor, one after another, not in parallel**, as the baseline does. Each body is built with piece 02's `buildBookingRequestPayload`:
  - `selected_option_ids: [thatVendorsOptionId]`
  - `quantities` from `bookingQuantitiesPayload`
  - `client_search_context` extended with `batchSize`, `batchIndex` and `source`, exactly as the baseline extends it.

  No batch endpoint exists; don't invent one.
- Results:
  - 0 succeeded: show "Requests not sent".
  - Some failed: show "{sent} of {total} requests sent".
  - All succeeded: close, call `clearSelection()` and navigate where the baseline's `onSuccess` goes (read it).

  There is no toast in foundation/ui, so show these as an inline notice in the modal, or in the bar for all-success. Say which in your report.
- No price leaves the browser. Estimates in the modal are display only.

## Where things go
- `web/src/domains/marketplace/marketplaceSelection.ts` (+ test): pure selection helpers (toggle, clear, list).
- `web/src/domains/marketplace/multiVendorEnquire.ts` (+ test): pure logic for:
  - building the per-vendor payloads (with batch fields);
  - the result summary (none, partial or all);
  - picking the default package per vendor, if the baseline preselects one.
- `useMarketplaceExplore.ts`: add the selection state.
- `MarketplaceVendorCard.tsx`: add the select control.
- `MarketplaceExploreView.tsx`: add the selection bar and the modal mount.
- `MultiVendorEnquireModal.tsx` and `MultiVendorPackagePicker.tsx`: new files.

## Tests (literal expected values)
- Selection: toggling twice removes the vendor; clear empties it.
- Three vendors produce three payloads with `batchIndex` 0, 1 and 2 and `batchSize` 3, each with exactly one `selected_option_ids` entry.
- Summary: (0 of 3) gives "Requests not sent"; (2 of 3) gives "2 of 3 requests sent"; (3 of 3) is all-success.
- No payload has a key containing "price", "total", "amount" or "fee".

## Allowed paths
- `web/src/domains/marketplace/**`

## Commit
`web: browse multi-select and multi-vendor enquiry (ws14 piece 12c)`
