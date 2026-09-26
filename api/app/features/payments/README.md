# payments

## Purpose
Stripe's side of Eventtz money: verifying Stripe's webhooks, and vendor payout setup
(Stripe Connect Express) with the vendor's payout ledger. The booking money flows
themselves (checkout, refunds, payouts) are booking lifecycle steps and live in the
bookings slice (`service_payments*.py`); this slice calls them, never the reverse.

## Use cases
- As **Stripe**, I **deliver a signed webhook**; it is verified by HMAC in pure code
  and acted on at most once per event id.
- As a **vendor**, I **set up payouts**: Eventtz opens a Stripe Express account
  (prefilled with my email, name, phone and business) and sends me to Stripe's
  onboarding link.
- As a **vendor**, I **check my payout setup**; while onboarding is unfinished the
  flags are refreshed from Stripe, afterwards `account.updated` keeps them current.
- As a **vendor**, I **read my payout ledger**: what was paid out and what is still
  held, in my share only.

## Invariants
- A webhook is verified with HMAC-SHA256 over `"{t}.{raw body}"` against
  `STRIPE_WEBHOOK_SECRET`, allowing 300 seconds of clock skew. An empty secret never
  verifies, so with no secret configured every webhook is a 400.
- Each handled event id is claimed in `stripe_webhook_events` before it is acted on;
  a redelivery is acknowledged and ignored. Unhandled types are not recorded.
- Once the signature is valid the webhook always answers 200: the handler runs in a
  savepoint, and a failure is logged and rolled back rather than retried forever.
- A Connect return path is allowlisted (`/vendor/payments` or `/vendor/bookings/{id}`),
  so Stripe's redirect cannot become an open redirect.
- Only an explicit "no such account / not on your platform" refusal marks a stored
  Connect account as orphaned; a 403 is a key mismatch and never clears an account.
- An orphaned account is replaced only when the vendor has no payout history; if a
  transfer was ever made through it, onboarding stops with
  `stripe_connect_restore_required` for staff to look at.
- The payout ledger shows the vendor's share (`vendor_amount_gbp` snapshot, else the
  priced lines), never the client total.

## Routes
- `POST /vendor/payments/connect-account?return_path=` (vendor)
- `GET /vendor/payments/status` (vendor)
- `GET /vendor/payments/history` (vendor)
- `POST /webhooks/stripe` (public, signed): `account.updated`

Differences from the baseline:
- With no Stripe key, `connect-account` is a 503 `payments_unavailable`, not a 500.
- Clearing an orphaned account is logged only; the baseline's audit row always
  failed to insert (it had no admin id), so no row was ever written there either.
