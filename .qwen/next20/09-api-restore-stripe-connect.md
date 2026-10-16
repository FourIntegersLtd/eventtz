# Piece 09 — api: `POST /admin/vendors/{user_id}/restore-stripe-connect` (super admin, Stripe: reviewed)

First read `.qwen/next20/rules-api.md` and follow it in full.
Depends on pieces 06 and 07, both committed. Piece 07 brought in `PaymentGateway.retrieve_transfer` and `repository_payments.latest_transfer_id_for_vendor`.

## Baseline
- Handler: `backend/app/features/admin/http/vendors.py:368-403`.
- Logic: `backend/app/features/payments/stripe.py:534`, `restore_vendor_connect_from_payout_history`.
- Auth: super admin. A plain admin gets 403 `super_admin_only`; the api already has `CurrentSuperAdmin` in `app/core/auth.py`.
- Flow:
  1. Stripe configured? If not: 400 "Stripe is not configured."
  2. Find the latest `booking_requests.stripe_transfer_id` for the vendor (query at stripe.py:540-553). None: 400 "No payout transfer found for this vendor."
  3. `Transfer.retrieve(id)`. Its `destination` gives the acct id; no destination: 400 "Could not resolve Connect account from the payout transfer."
  4. `Account.retrieve(acct)` gives `charges_enabled` and `payouts_enabled`.
  5. Update `vendors`: `stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled` (stripe.py:565-571).
  6. Insert an admin audit log entry with `action="vendor.stripe_connect_restored"` (vendors.py:386-395); copy its exact details.
  7. Any other exception: **502** "Could not restore Stripe Connect." Match the baseline's 502; don't use 503.
- Response `AdminVendorRestoreStripeConnectResponse`: `{success, user_id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, restored_from_transfer_id}`.

## Where it goes (the ws12 plan)
- Route: a new `api/app/features/payments/router_admin.py`, with `CurrentSuperAdmin`. Register it in `api/app/main.py` next to the other payments routers.
- Service: `payments/service.py`, `restore_connect_from_payout_history(session, gateway, *, vendor_user_id, actor)`.
  - It reads the transfer id through the bookings service or the repository function piece 07 added. Payments may import `bookings.service*`, not the bookings repository; add a thin service function in bookings if needed.
  - It writes vendor fields through the vendors slice's service. Check `vendors/service*.py` for an existing Connect-fields update and reuse it.
  - It writes the audit entry through the staff audit service. Grep `record_audit` or similar in `api/app/features/staff`.
- Errors: `PayoutTransferNotFound` and `ConnectAccountResolveFailed` in `vendors/errors.py` or `payments/errors.py` (keep them with the other Connect errors), plus `StripeNotConfigured` if it doesn't already exist. The 502 needs an AppError subclass with status 502; check `core/errors.py`. If none exists, add `BadGateway(AppError)` with status 502 to `core/errors.py`, and mention it in the report.
- The gateway: add `retrieve_account(acct_id)` to the `PaymentGateway` port only if no equivalent exists. Grep the port for an account-status read first; the Connect status route probably already has one. Update the adapter and `FakePaymentGateway`.
- No idempotency key is needed: this makes no Transfer or Refund, only reads.

## Tests
- http, with FakePaymentGateway:
  - 401, and 403 for a client and for a plain admin;
  - not configured: 400;
  - no transfer: 400;
  - transfer without a destination: 400;
  - the gateway raises: 502 with the exact message;
  - happy path: the response is literal, the vendor row is updated and one audit row is written.
- Acceptance: remove the remaining `test_receipts.py` entry from `NOT_YET_ON_API`. `make test TARGET=api ARGS=test_receipts.py` must pass in full, and the baseline must stay green.
- Payments README: add Routes and Use cases. Vendors README line 31: remove restore-Connect from "Cut 2".

## Generated files
Run `make openapi` and `npm run api:types`, and commit both.

## Allowed paths
- `api/app/features/payments/**`, `vendors/**`, `bookings/**` (a service function only) and `staff/**` (only if the audit service needs a public function)
- `api/app/main.py`, `api/app/core/errors.py`, `api/app/core/ports.py` and `api/app/adapters/stripe_payments.py`
- `api/tests/**`, `acceptance/conftest.py`, `api/openapi.json` and `web/src/foundation/platform-client/schema.d.ts`

## Commit
`api: restore vendor Stripe Connect from payout history (ws12)`
