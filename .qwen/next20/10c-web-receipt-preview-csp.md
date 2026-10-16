# Piece 10c — web: receipt preview blocked by CSP, seed vendor can't reach the portal (from the 10b review of a4bd373 + 432dbc2)

First read `.qwen/next20/rules-web.md` and follow it in full. Commit only your own paths.

Review result: the 10b code matches the baseline (blob iframe, Print on the iframe, Stripe link, no Download, receipt-links capability, vendor links). The client links work at 1280 and 375 with no horizontal overflow, and the unpaid booking shows "Document unavailable" with the api detail. Two things block the browser check, plus one dead prop.

## 1. BUG: the CSP blocks the receipt iframe
`web/src/middleware.ts` `contentSecurityPolicy()` has no `frame-src` (and no `child-src`), so it falls back to `default-src 'self'` and the `blob:` iframe is refused. In the browser the iframe's document is inaccessible and the height stays at 320px.
- Add `"frame-src 'self' blob:"` to the directive list. Nothing wider (no `*`, no `https:`).
- Grep the baseline (`frontend/next.config.*`, `frontend/middleware.*`) for a CSP; if it has one, say in the report whether it sets `frame-src`.
- Add or extend a unit test of `contentSecurityPolicy()` that asserts the literal `frame-src 'self' blob:` directive and still `frame-ancestors 'none'`.
- Print: `PaymentReceiptPreview` enables Print on the iframe `load` event, which fires even when the page is blocked. Enable it only once `iframe.contentDocument` is readable (the same check the height sync uses). Keep the baseline wording.

## 2. BUG: the seed vendor is redirected to /vendor/profile
`api/scripts/seed_local_receipts.py` `_ensure_vendor_listing` (~line 107) saves `"status": "complete"`. `vendorIsLiveApproved` (`web/src/domains/vendor-shell/vendorAccess.ts`) needs `onboarding_status === "submitted"` and `approval_status === "approved"`, so every vendor page redirects to the profile.
- Save `"status": "submitted"` (check which column/field feeds `onboarding_status` in the api's vendor read and set that).
- Re-running `make seed-receipts` must fix an existing local vendor too (update, not insert-only).

## 3. Dead code
`web/src/capabilities/receipt-links/ReceiptLink.tsx` has an optional `paymentStatus` prop no caller passes. Delete the prop, its check and the docstring clause.

## 4. Browser check (required, web :3001 + api :8001, after `make seed-receipts`)
Sign in as `client@example.com` / `vendor@example.com` (`LocalAdmin123!`). Report each item as seen:
- `/client/bookings/a0000000-0000-4000-8000-000000000001/receipt`: the iframe shows the event name and total, the height grows past 320px, Print opens the print dialog, the Stripe link is present.
- `/vendor/bookings/…001`: "Payment record" only. `/vendor/bookings/…002`: "Payment record" and "Payout statement". Open both documents; each renders in the iframe.
- `…003` receipt: "Document unavailable" with the api message.
- Repeat the receipt pages at 375px: no horizontal scroll, iframe fits the width.
- The browser console shows no CSP violation.

## Allowed paths
- `web/src/middleware.ts` (and its test)
- `web/src/domains/receipts/**`
- `web/src/capabilities/receipt-links/**`
- `api/scripts/seed_local_receipts.py`

## Done
- web `npm run ci` exits 0 (report `# tests` / `# pass`); api `make ci` exits 0.
- Commits: `web: receipt preview allowed by CSP, Print waits for the document (ws14)` and `api: seed-receipts vendor passes the portal gate (ws14)`, both with the Cursor trailer.
- Report in 10 lines or fewer, listing each browser check from section 4 and what you saw.
