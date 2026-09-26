# payments

## Purpose
Stripe's side of Eventtz money: verifying Stripe's webhooks, and vendor payout setup
(Stripe Connect Express) with the vendor's payout ledger. The booking money flows
themselves (checkout, refunds, payouts) are booking lifecycle steps and live in the
bookings slice (`service_payments*.py`); this slice calls them, never the reverse.

## Use cases
- As **Stripe**, I **deliver a signed webhook**; it is verified by HMAC in pure code.

## Invariants
- A webhook is verified with HMAC-SHA256 over `"{t}.{raw body}"` against
  `STRIPE_WEBHOOK_SECRET`, allowing 300 seconds of clock skew. An empty secret never
  verifies, so with no secret configured every webhook is a 400.
- A Connect return path is allowlisted (`/vendor/payments` or `/vendor/bookings/{id}`),
  so Stripe's redirect cannot become an open redirect.
- Only an explicit "no such account / not on your platform" refusal marks a stored
  Connect account as orphaned; a 403 is a key mismatch and never clears an account.

## Routes
Built in the next milestone.
