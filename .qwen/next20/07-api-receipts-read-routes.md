# Piece 07 — api: client receipt, vendor payment-record and payout-statement routes (MONEY: reviewed)

First read `.qwen/next20/rules-api.md` and follow it in full.
Depends on piece 06, which must be committed: `acceptance/test_receipts.py` is green on the baseline and xfail on api.

## Goal
Build the 6 read routes, JSON plus `.html` for each of the three documents, so that tests 1–15 of `test_receipts.py` pass on `TARGET=api`. Restore-Connect (tests 16–19) is piece 09; leave those xfail by narrowing the `NOT_YET_ON_API` entry.

## Start from the WIP commit
Commit `49f78db`, on branch `worktree-agent-ac0d0cd500364bf5c`, was written against an older mainline and **never run**. Bring its changes in without committing them:
`git cherry-pick -n 49f78db`
If a file conflicts, open it, keep mainline's current code and add the WIP's new parts by hand. What it adds:
- `bookings/domain_receipts.py` (327 lines): pure builders, ported from `backend/app/features/bookings/receipts.py`;
- `bookings/repository_receipts.py`: `get_booking_for_receipt`, reading the snapshot columns;
- `bookings/rows.py`: `ReceiptBookingRow`;
- `bookings/errors.py`: `ReceiptNotAvailable`, `ReceiptStripeVerifyFailed`;
- `bookings/repository_payments.py`: `latest_transfer_id_for_vendor`;
- `core/ports.py`, `adapters/stripe_payments.py` and `tests/support/fakes.py`: `PaymentGateway.retrieve_transfer`.

**Check every line of `domain_receipts.py` against the baseline's `receipts.py`**, including field names, receipt-number format, status notes and rounding. It was never executed.

## Baseline reference
- `backend/app/features/bookings/receipts.py`:
  - `load_payment_snapshot` :214
  - `verify_client_receipt_with_stripe` :27
  - `build_client_payment_receipt`
  - vendor builders
  - `RECEIPT_ELIGIBLE_STATUSES = {paid, payout_released, refunded, partially_refunded}`
  - `PAYOUT_STATEMENT_STATUSES = {payout_released}`
- `backend/app/features/bookings/receipt_document.py`: `receipt_html_bytes`, `receipt_html_response` (attachment filename)
- `backend/app/contracts/receipts.py`: `PaymentReceiptResponse{receipt: PaymentReceiptPayload}`
- `backend/app/features/payments/stripe.py`: `verify_payment_for_receipt`
- Templates: `backend/app/features/email/templates/booking/receipt_document.html` and `booking/partials/receipt_table.html`
- Baseline unit tests to port as api unit tests:
  - `backend/tests/test_receipts.py` (12 tests):
    - test_receipt_number_format
    - test_client_receipt_uses_payment_snapshot_amounts
    - test_client_receipt_rejects_unpaid
    - test_vendor_payment_record_shows_vendor_share
    - test_vendor_payout_statement_requires_payout_released
    - test_vendor_payout_statement_includes_transfer_ref
    - test_refunded_receipt_has_status_note
    - test_frozen_snapshot_preserves_line_items_when_booking_changes
    - test_vendor_payment_record_after_payout_shows_released_note
    - test_frozen_client_receipt_hides_payout_date_after_vendor_payout
    - test_payment_receipt_response_rejects_corrupt_payload
    - test_payment_receipt_payload_serializes_booking_request_id
    - test_client_receipt_live_lines_include_referral_discount: uses a MagicMock in the baseline; in api, pass a fake or a plain value.
  - `backend/tests/test_receipt_document.py`:
    - test_receipt_html_bytes_includes_event_and_total
    - test_receipt_html_response_attachment
    - test_client_receipt_html_omits_payout_line
  - `backend/tests/test_receipt_stripe_verify.py`: port its cases against `FakePaymentGateway`.

## What to build
- `api/app/features/bookings/service_receipts.py`:
  - `client_receipt(session, gateway, *, client_user_id, booking_id)`
  - `vendor_payment_record(session, *, vendor_user_id, booking_id)`
  - `vendor_payout_statement(...)`

  Each returns the payload. Order:
  1. ownership: 404 `booking_not_found`, "Booking not found.";
  2. for the client only, Stripe verify, unless the snapshot is already frozen;
  3. the builder: 404 "No receipt is available for this booking yet.".

  Reuse the bookings slice's existing codes: grep `errors.py` for BookingNotFound.
- The client Stripe verify goes through `PaymentGateway`. Never call Stripe directly. Check the payment intent the same way `verify_payment_for_receipt` does.
- HTML: render `receipt_document.html` byte-for-byte like the baseline.
  - Templates live in `api/app/features/notifications/templates/`, and rendering in `notifications/rendering.py`. Put `booking/receipt_document.html` and `booking/partials/receipt_table.html` there.
  - Add a small `notifications` service function, `render_receipt_document(payload) -> str`, that bookings calls. A slice may import another slice's service.
- Routes:
  - Client routes in `bookings/router_client.py`.
  - Vendor routes in `bookings/router_vendor.py`, or a new `router_receipts.py` if the routers are near the size limit the guards allow.
  - The `.html` routes use `response_class=HTMLResponse` and set `Content-Disposition: attachment; filename=<kind>-{receipt_number}.html` (`receipt`, `payment-record` or `payout-statement`).
  - Declare `responses=error_responses(...)`. Paths must match `api/openapi.baseline.json` exactly.
- Schemas: `PaymentReceiptPayload` and `PaymentReceiptResponse` in `bookings/schemas_receipts.py`, with the same field names and types as `backend/app/contracts/receipts.py`. Money fields keep the baseline's JSON representation (check whether they're decimal pounds or pence, and match it).
- **Goldens:** add `api/tests/golden/receipts/`. Capture the three HTML documents (client receipt, payment record, payout statement) from the **baseline's own renderer** for two fixed payloads each, then assert byte equality. Look at `api/tests/golden/test_notification_goldens.py` to see how fixtures were captured, and follow that precedent, including how the capture script ran baseline code.
- Unit tests for `domain_receipts.py`, and http tests (`api/tests/http/`) for the 6 routes with `FakePaymentGateway`.
- README: add the Use cases, Routes and the invariant "snapshots are write-once; a frozen snapshot is returned as-is with the live payment_status laid over it". Remove "receipts" from the Deferred section.

## Acceptance
- Narrow the conftest entry to the restore-Connect tests only, e.g. `"test_receipts.py::test_restore_*"`. Use the names piece 06 chose.
- `make test TARGET=api ARGS=test_receipts.py`: tests 1–15 pass.
- The baseline run stays green.

## Generated files
Run `make openapi` and `npm run api:types`, and commit both. This adds 6 operations.

## Allowed paths
- `api/app/features/bookings/**`
- `api/app/features/notifications/**` (templates and the render function)
- `api/app/core/ports.py`
- `api/app/adapters/stripe_payments.py`
- `api/tests/**`
- `api/openapi.json`
- `web/src/foundation/platform-client/schema.d.ts`
- `acceptance/conftest.py`

## Commit
`api: receipts, vendor payment record and payout statement (ws12)`
