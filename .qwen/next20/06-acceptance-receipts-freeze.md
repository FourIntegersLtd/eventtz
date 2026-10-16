# Piece 06 — acceptance: freeze receipts, statements and restore-Connect on the baseline

First read `.qwen/next20/rules-api.md` and follow it in full. This piece writes **tests only**; there is no api/ code.

## Goal
Write `acceptance/test_receipts.py`, get it green against the **baseline** (:8000), then mark it strict-xfail for api and commit. Pieces 07–09 build api until it passes.

## The 7 baseline operations
Read each handler.
| Route | Handler | Auth |
|---|---|---|
| `GET /api/v1/client/booking-requests/{id}/receipt` | `backend/app/features/bookings/http/client.py:147` | client |
| `GET /api/v1/client/booking-requests/{id}/receipt.html` | `client.py:175` | client |
| `GET /api/v1/vendor/booking-requests/{id}/payment-record` (+ `.html`) | `backend/app/features/bookings/http/vendor.py:258,273`, helper `_vendor_receipt_payload` :242 | vendor |
| `GET /api/v1/vendor/booking-requests/{id}/payout-statement` (+ `.html`) | `vendor.py:291,306` | vendor |
| `POST /api/v1/admin/vendors/{user_id}/restore-stripe-connect` | `backend/app/features/admin/http/vendors.py:368-403` | super admin |

Logic lives in:
- `backend/app/features/bookings/receipts.py` (620 lines): `load_payment_snapshot` :214, `verify_client_receipt_with_stripe` :27, the builders, `RECEIPT_ELIGIBLE_STATUSES`, `PAYOUT_STATEMENT_STATUSES`;
- `backend/app/contracts/receipts.py`: the response shapes;
- `backend/app/features/payments/stripe.py:534`: restore.

Messages:
- "Booking not found."
- "No receipt is available for this booking yet."
- "Unable to verify payment with Stripe. Please try again later."
- "Stripe is not configured."
- "No payout transfer found for this vendor."
- "Could not resolve Connect account from the payout transfer."
- "Could not restore Stripe Connect."

## How to seed without Stripe
Copy the seeding helpers' style from `acceptance/test_payments.py` (`_seed_bookable_vendor` :61, `_seed_booking_row` :94) and use the fixtures in `acceptance/conftest.py`.
- Local Stripe is not configured on either target, so freeze only cases that don't call Stripe:
  - **Client receipt, happy path:** seed a booking with `payment_status="paid"` and a **frozen** `payment_receipt_snapshot` (jsonb). Use `document_type: "client_payment_receipt"` and the other fields `build_client_payment_receipt` writes. Read receipts.py to build a realistic one with @example.com data. The baseline returns a frozen snapshot as-is (with the live `payment_status` laid over it), so this path never calls Stripe.
  - **Vendor payment-record and payout-statement, happy paths:** these have no Stripe step. Seed a booking with a pricing breakdown and a status in the eligible set:
    - payment-record: paid, payout_released, refunded or partially_refunded;
    - payout-statement: payout_released only.
- Read `acceptance/support/` and conftest to see how `admin_db` writes rows on both targets. Use that; never write SQL that only one target understands.

## Cases (one test each; assert status, `code` and exact `detail`)

Client receipt:
1. Without a session: 401.
2. As a vendor: 403, with the baseline's code.
3. As a different client (not your booking): 404, "Booking not found."
4. Unknown booking id: 404, "Booking not found."
5. Unpaid booking with no snapshot and no `pi_` id: 404. Freeze whatever the baseline returns, **either** the Stripe-verify message **or** "No receipt…"; read `verify_client_receipt_with_stripe` to predict it, then assert the baseline's actual answer.
6. Happy path, JSON: 200. Assert `receipt.document_type`, `receipt.receipt_number` and the money fields you seeded, as literal values.
7. Happy path, `.html`: 200, `content-type` starts with `text/html`, `content-disposition` is `attachment; filename=receipt-{receipt_number}.html`, and the body contains the receipt number and the vendor name.

Vendor payment-record:
8. As a client: 403.
9. Booking of another vendor: 404, "Booking not found."
10. `payment_status="unpaid"`: 404, "No receipt is available for this booking yet."
11. Happy path, JSON: 200, with key fields literal.
12. Happy path, `.html`: filename `payment-record-{n}.html`.

Vendor payout-statement:
13. `payment_status="paid"` (not yet released): 404. Freeze the baseline's exact message.
14. Happy path with `payout_released`, JSON: 200.
15. Happy path, `.html`: filename `payout-statement-{n}.html`.

Restore-Connect:
16. Without a session: 401.
17. As a client: 403.
18. As a plain admin (`as_staff`): 403, code `super_admin_only` (check the baseline's code).
19. As a super admin, with Stripe not configured locally: freeze the baseline answer, probably 400 "Stripe is not configured.". If the baseline checks the transfer first, it's 400 "No payout transfer found for this vendor.". Assert what it actually returns.

Also assert that no row changed on the vendor after 17–19: `stripe_account_id` is unchanged.

## Steps
1. `cd acceptance && make serve`, which serves the baseline on :8000. Reuse it if it's already up.
2. Write the file. `make test ARGS=test_receipts.py` until all tests pass on the baseline; check the exit code.
3. Add `"test_receipts.py::*"` to `NOT_YET_ON_API` in `acceptance/conftest.py`, with the reason "receipts and restore-Connect arrive in next20 pieces 07-09".
4. Optional: if api :8001 is up, run `make test TARGET=api ARGS=test_receipts.py` and confirm everything xfails, with no XPASS.

## Allowed paths
`acceptance/test_receipts.py` and `acceptance/conftest.py` (the NOT_YET_ON_API line only). A new helper in `acceptance/support/` only if it can't live in the test file.

## Commit
`acceptance: freeze receipts, vendor statements and restore-Connect (ws12)`

Report the baseline pass count and anything the baseline did that surprised you (for example, which message case 5 returned).
