# Piece 10 — web: client receipt page and vendor payment-record / payout-statement pages

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on piece 07, which must be committed: the 6 receipt operations exist in `web/src/foundation/platform-client/schema.d.ts`. Check with `grep -n "receipt\|payment-record\|payout-statement" web/src/foundation/platform-client/schema.d.ts` before starting. If they're missing, stop and report.

## Facts
- Vendor stubs to replace:
  - `web/src/app/vendor/(portal)/bookings/[bookingId]/payment-record/page.tsx`
  - `.../payout-statement/page.tsx`

  Both show "…aren't available yet." Keep the URLs.
- They're linked from `web/src/domains/vendor-bookings/BookingDetailView.tsx:83,86`.
- There's no client receipt page yet: `web/src/app/client/(portal)/bookings/[bookingId]/` has only `page.tsx` and `pay/`.

## Baseline reference (port the look, copy and states)
- Page: `frontend/app/client/(portal)/bookings/[bookingId]/receipt/page.tsx`, which renders `ClientPaymentReceiptView`.
- Vendor pages: `frontend/app/vendor/(portal)/bookings/[bookingId]/payment-record/page.tsx` and `payout-statement/page.tsx`.
- Shared shell: grep `ReceiptPageShell` in `frontend/features/`. Port its layout: header, receipt number, dates, line items table, totals, status note, and the "Download" and "Print" actions.
- Fetching: `frontend/lib/receiptsApi.ts:63-74`. The HTML download uses the `.html` endpoint.
- Where the client bookings detail links to the receipt: grep `receipt` in `frontend/features/client/bookings/` (or similar). Add the same link to `web/src/domains/client-bookings/` detail, under the same condition (only the payment statuses the baseline shows it for).

## What to build
- A new domain, `web/src/domains/receipts/`. It's shared by both portals, so no portal prefix.
  - `api.ts`: `fetchClientReceipt(bookingId)`, `fetchVendorPaymentRecord(bookingId)` and `fetchVendorPayoutStatement(bookingId)`, all through `platformRequest`.
  - `receiptDownload.ts`: the pure function `receiptHtmlPath(kind, bookingId)`, returning the same-origin `/api/v1/...receipt.html` path.
    - The download must carry the Bearer token, so a plain `<a href>` won't work. Fetch the `.html` with `platformRequest` (or the client's raw-response helper, if `foundation/platform-client` has one; check first). Then make a Blob and trigger a download with the filename from `Content-Disposition`.
    - If platform-client can't return text or a Blob without changes, add the **smallest** option to it (e.g. `responseType: "text"`), with a test, and mention it in the report.
  - `ReceiptPageShell.tsx`: the layout.
  - `ReceiptDocumentView.tsx`: renders the payload.
  - `receiptFormat.ts` (+ test): the money and date labels.
    - Money comes formatted exactly as the baseline shows it. Check whether the payload is in pence or pounds (piece 07 matched the baseline) and format only at the edge.
    - Use the existing money formatter in `foundation/` if there is one; grep `formatGbp` or `formatMoney`.
- Pages:
  - `web/src/app/client/(portal)/bookings/[bookingId]/receipt/page.tsx`
  - replace the two vendor stubs.

  Each page is a thin wrapper around `ReceiptPageShell` and a hook in the domain.
- States:
  - Loading: Spinner.
  - 404 with detail "No receipt is available for this booking yet.": show the detail and a back link.
  - Any other error: show the detail, or "Could not load receipt. Try again." (use the baseline's exact copy if it differs).
- A print button: `window.print()`, plus `print:` Tailwind classes to hide the shell chrome, if the baseline does that.

## Tests
- `receiptFormat.test.ts` with literal values: pence/pounds to "£1,234.50", a date label, the refunded status note.
- `receiptDownload.test.ts`: the paths for the 3 kinds, and filename parsing from a `Content-Disposition` header.

## Allowed paths
- `web/src/domains/receipts/**`
- `web/src/domains/client-bookings/**` (the receipt link only)
- `web/src/app/client/(portal)/bookings/[bookingId]/receipt/**`
- `web/src/app/vendor/(portal)/bookings/[bookingId]/payment-record/**` and `payout-statement/**`
- `web/src/foundation/platform-client/**`, only if the download needs it

## Browser check
With api :8001 and web :3001 up, and a local paid booking (seed one via acceptance helpers, or reuse one from acceptance), open all three pages. Check that the download saves an `.html` file that opens.

## Commit
`web: client receipt and vendor payment record / payout statement pages (ws14)`
