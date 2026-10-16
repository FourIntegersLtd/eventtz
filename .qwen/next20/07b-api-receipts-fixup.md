# Piece 07b — api: receipts fix-up after review of 4065fd3 (MONEY: reviewed)

First read `.qwen/next20/rules-api.md` and follow it in full. Mainline is 4065fd3 plus whatever web piece is running beside you. Commit only your own paths.

Review result: builders, receipt number, labels, rounding, status notes, schema, the six paths, filenames and templates all match the baseline. The goldens were re-captured from the baseline renderer and are byte-identical. What's left is the Stripe-verify path, which refuses receipts the baseline serves, plus some clean-up and missing tests.

## 1. BUG: Stripe-verify status codes and the frozen fallback
Baseline: `backend/app/features/bookings/receipts.py:27-60`, `verify_client_receipt_with_stripe`, and `backend/app/features/payments/stripe.py` ~730-790, `verify_payment_for_receipt`. The rule is:

| Case | Unfrozen | Frozen snapshot |
|---|---|---|
| no `pi_` id | 404 `RECEIPT_STRIPE_VERIFY_FAILED` | serve |
| Stripe `resource_missing` | serve (log warning) | serve |
| any other Stripe or network error (5xx, 429, 401, timeout, `http_status=0`, `PaymentsUnavailable`) | **503** | serve |
| bad `amount_received` (TypeError, ValueError) | **503** | serve |
| amount mismatch | **503** | serve |
| PI status is not `succeeded` | 403 "Payment is not completed" | 403, not overridden |

Today `api/app/features/bookings/service_receipts.py:55-93`:
- serves a frozen receipt only for `PaymentsUnavailable` or `http_status >= 500`;
- refuses a frozen receipt on a mismatch or a bad amount;
- raises `ReceiptStripeVerifyFailed(NotFound)`, so every failure is 404.

Fix:
- Split the error in `bookings/errors.py`:
  - `ReceiptStripeVerifyFailed(Unavailable)` (503, `core/errors.py:100`), code `receipt_stripe_verify_failed`, message "Unable to verify payment with Stripe. Please try again later.";
  - the missing-`pi_` case, a `NotFound` with the same message. Keep whatever `code` `acceptance/test_receipts.py` asserts for that 404 (case 5); grep it first.
- In `_verify_client_receipt_with_stripe`, every 503-class outcome returns early when `has_frozen`, as the baseline does:
  - `PaymentsUnavailable`;
  - any `PaymentGatewayError` except `resource_missing`;
  - a bad amount;
  - a mismatch.
- The 403 message is "Payment is not completed", with no full stop, as in the baseline.
- Update `responses=error_responses(...)` on the client receipt routes (JSON and `.html`) to list 503. Then run `make openapi` and `npm run api:types`, and commit both.

## 2. Pricing runs before the frozen check
`service_receipts.py:140,164,188` call `service_pricing.current_breakdown` (and the name lookups) before `payload_from_frozen_or_build`. The baseline prices only inside `_build_live` (`receipts.py:324,375,427`). A frozen document must not fail because pricing or a referral lookup fails.
- Build the live payload only when there is no frozen snapshot: check first, then do the async lookups and the builder.
- Keep the builder's 404 as it is.

## 3. Clean-up
- Delete the three `except ReceiptNotAvailable: raise` blocks; they do nothing.
- `domain_receipts._format_gbp` (:26) repeats `pricing.domain.format_gbp`. Use that one if its output is identical for every input the goldens and unit tests use (run them). If it differs, keep yours with a one-line comment saying why.
- `notifications/domain_receipt_documents.py` repeats `domain_receipts.receipt_email_context`. Keep one copy (piece 08 will call it for emails) and delete the other.
- Rename `pb=` / `pb` to `pricing_breakdown`: no cryptic names (AGENTS.md).
- **Keep** `repository_payments.latest_transfer_id_for_vendor` and `PaymentGateway.retrieve_transfer`: piece 09 uses them. Add a one-line comment on each saying so.

## 4. Missing tests (with `FakePaymentGateway`, no `patch("app.…")`)
Unit tests on the verify function, or http tests. Assert literal status, code and message:
- frozen snapshot plus each of: gateway 500, gateway 429, a network error (`http_status=0`), `PaymentsUnavailable`, an amount mismatch (525.0 against 52499). Each gives 200 with the frozen payload.
- unfrozen plus a gateway 500 gives 503 `receipt_stripe_verify_failed`; unfrozen plus a mismatch gives 503.
- unfrozen, no `pi_` gives 404; frozen, no `pi_` gives 200.
- PI status `processing` gives 403 "Payment is not completed", whether frozen or not.
- frozen snapshot plus a pricing service that raises: still 200. Use a fake or an injected dependency. If pricing can't be injected, test it at the http level with a booking whose pricing data is broken.
- `.html` routes, one per document: status 200, `content-type` text/html, and `Content-Disposition: attachment; filename=receipt-EVT-XXXXXXXX.html` (likewise `payment-record-…` and `payout-statement-…`), and the body contains the event name and total.
- A client receipt with `payout_released_at` set: the HTML has no payout line (baseline `test_client_receipt_html_omits_payout_line`).
- `test_receipt_stripe_verify.py::…allows_missing_pi_in_stripe_account`: also assert that the fake recorded the retrieve call.

## Allowed paths
- `api/app/features/bookings/**`
- `api/app/features/notifications/**`
- `api/tests/**`
- `api/openapi.json`
- `web/src/foundation/platform-client/schema.d.ts`

## Done
- `make ci` exits 0.
- `make test TARGET=api ARGS=test_receipts.py` gives 17 passed and 4 xfailed; the baseline gives 21 passed.
- Restart `make dev` on :8001 first.

Commit `api: receipts verify matches baseline 503 and frozen fallback (ws12)` with the Cursor trailer.

Report in 10 lines or fewer: the commit hash, the test counts, the `_format_gbp` decision, and which file you kept for the email context.
