# Piece 10b — web: receipt pages fix-up after review of ceb95c9

First read `.qwen/next20/rules-web.md` and follow it in full. Mainline includes ceb95c9. Commit only your own paths.

Review result: the fetch paths, the eligible payment statuses, the "Document unavailable" panel and the back link match the baseline. CI: 437/437.

The prompt for piece 10 was wrong about the document view; that was my mistake, not yours. The baseline does **not** render the JSON payload itself. It shows the **server's HTML** (the frozen document) in an iframe, and that HTML is the single source of truth. This piece fixes that, plus the links and the browser check.

## 1. Show the server HTML, as the baseline does
Baseline:
- `frontend/features/receipts/PaymentReceiptView.tsx` (the whole file);
- `frontend/features/receipts/ReceiptPageShell.tsx`:
  - load the JSON first, then fetch the `.html` as a Blob;
  - `URL.createObjectURL`, revoked on reload and unmount;
  - the preview has its own loading, error and "Try again" states;
  - a request-id guard.

Port it:
- **Header:** the title (`receiptDocumentTitle`), then `receipt_number` under it.
- **Actions:**
  - "Print", shown only when the blob URL exists and disabled until the iframe has loaded. It calls `iframe.contentWindow.print()`, not `window.print()`.
  - "Card receipt (Stripe)", when `stripe_receipt_url` is set.
- **Body:**
  - while the HTML loads: "Loading receipt…";
  - if it fails: the error detail, or "Could not load the receipt preview.", with a "Try again" button that reloads;
  - otherwise the iframe (`title` = the document title), with its height synced to the content on load and on window resize.
- **Delete** `ReceiptDocumentView.tsx` and the "Download" button. The baseline has no Download.
- Build the Blob from `platformRequestText` (keep it) with `new Blob([text], { type: "text/html;charset=utf-8" })`.
- Rename `receiptDownload.ts` to `receiptHtml.ts`:
  - keep `receiptHtmlPath` and its test;
  - delete `filenameFromContentDisposition` and `downloadReceiptHtml`, along with their tests.
- **Load-error fallback:** use the baseline's copy, "Could not load this document. It may not be available yet." Delete the web-only "No receipt is available for this booking yet." and "Could not load receipt. Try again.". An api `detail` still wins.
- Give `useReceipt` the preview state, or move the logic into the shell as the baseline does, whichever is smaller. Keep the stale-response guard.

## 2. Dead code
`receiptFormat.ts` has helpers that only the tests use:
- `formatReceiptMoneyFromPence`
- `formatReceiptMoneyFromGbp`
- `receiptStatusNote`
- `bookingHasPaymentReceipt`
- `formatReceiptDate`, which is dead once `ReceiptDocumentView` goes

Delete them and their tests (AGENTS: "subtract before you add"; money labels come formatted from the api). Keep `receiptDocumentTitle` and give it a test with literal values.

## 3. Receipt links: one shared helper, used in three places
Domains can't import each other (`eslint.config.mjs` boundaries), so the helper goes in a **capability**, `web/src/capabilities/receipt-links/`. Port from the baseline `frontend/lib/receiptsApi.ts`:
- `hasPaymentReceipt(paymentStatus)`: true for paid, payout_released, refunded and partially_refunded;
- `receiptViewHref(documentType, bookingId)`;
- `ReceiptLink`, ported from `frontend/features/receipts/ReceiptActions.tsx`:
  - labels "View receipt" / "Payment record" / "Payout statement";
  - a `compact` variant, a text link that calls `stopPropagation` on click;
- a test for `hasPaymentReceipt` and `receiptViewHref` with literal values.

Use it in:
- `web/src/domains/client-bookings/BookingDetailView.tsx`: replace the local `CLIENT_RECEIPT_PAYMENT_STATUSES` and the hand-written link.
- `web/src/domains/client-bookings/ClientPaymentsView.tsx`: a compact "View receipt" on each row where `hasPaymentReceipt`. Baseline: `frontend/features/client/payments/ClientPaymentsView.tsx:65-71`.
- `web/src/domains/vendor-bookings/BookingDetailView.tsx:81-90`: **BUG today.**
  - It shows both links only when `payment_status === "paid"`. So "Payout statement" is shown when there is no statement yet (404), and both links disappear after payout or a refund.
  - Baseline, `frontend/features/vendor/bookings/VendorBookingDetailExtras.tsx:64-78`: "Payment record" when `hasPaymentReceipt`, and "Payout statement" only when `payment_status === "payout_released"`.

## 4. Local receipt data, so the browser check can run
There is no local paid booking. Add `api/scripts/seed_local_receipts.py` and a `make seed-receipts` target. Model it on `seed_local_admins.py`:
- the same `LOCAL_HOSTS` guard;
- the same tombstone rule;
- docstrings on every function;
- print only emails and booking ids.

It creates:
- `client@example.com` (client) and `vendor@example.com` (vendor, approved), password `LocalAdmin123!`;
- booking A: accepted and **paid**, with `stripe_payment_intent_id` `pi_local_seed_a`;
- booking B: completed and **payout_released**, with a `stripe_transfer_id`.

For each booking, call `service_receipts.freeze_after_checkout` (and `freeze_after_payout` for B) with a `FakeMailer`-style no-op mailer, so the frozen snapshots exist. Write through slice services and repositories, never raw SQL. If you can't fill a column without raw SQL, stop and report which one.

**Stripe verify:** the client receipt route verifies the PI with Stripe unless a snapshot is frozen. Check that local mode serves a frozen receipt without a Stripe key; if it doesn't, say so.

## 5. Browser check (required this time)
Use the CDP recipe in the memory notes, or any real browser.
- api :8001 (`make dev`), web :3001 (`npm run dev`).
- Sign in as the client:
  - `/client/bookings/<A>` shows "View receipt";
  - `/client/payments` shows the compact link on A's row;
  - `/client/bookings/<A>/receipt` shows the iframe with the event name and total, and Print is enabled.
- Sign in as the vendor:
  - `/vendor/bookings/<A>` shows "Payment record" only;
  - `/vendor/bookings/<B>` shows both links;
  - both documents render in the iframe.
- `/client/bookings/<unpaid id>/receipt` shows "Document unavailable" with the api detail.
- Check at 375px: no horizontal scroll.

## Allowed paths
- `web/src/domains/receipts/**`
- `web/src/domains/client-bookings/**`
- `web/src/domains/vendor-bookings/**` (the receipt links only)
- `web/src/capabilities/receipt-links/**`
- `web/src/app/client/(portal)/bookings/[bookingId]/receipt/**`
- `web/src/app/vendor/(portal)/bookings/[bookingId]/payment-record/**` and `payout-statement/**`
- `api/scripts/**`
- `api/Makefile`

## Done
- web `npm run ci` exits 0 (report `# tests` / `# pass`).
- api `make ci` exits 0.
- Two commits, both with the Cursor trailer:
  - `web: receipt pages preview the server document, links match the baseline (ws14)`
  - `api: seed local paid bookings with frozen receipts for browser checks (ws14)`
- Report in 10 lines or fewer, including each browser check and what it showed.
