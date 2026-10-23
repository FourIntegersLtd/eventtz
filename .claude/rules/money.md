---
paths:
  - "api/app/features/{payments,pricing,referrals}/**"
  - "api/app/features/bookings/{domain_financials,domain_cancellation,domain_policy,domain_payments,domain_receipts,repository_payments,repository_receipts,schemas_payments,schemas_receipts,schemas_terms,service_payments,service_payments_checkout,service_payout_ledger,service_receipts,service_deposits,service_admin_financials,service_pricing}.py"
  - "api/app/adapters/stripe_payments.py"
  - "api/tests/golden/**"
  - "web/lib/policyConstants.json"
  - "web/app/client/(portal)/bookings/[bookingId]/{pay,receipt}/**"
  - "web/app/{client,vendor}/(portal)/payments/**"
  - "web/app/admin/(portal)/{commerce,referrals}/**"
  - "web/features/{receipts,client/payments,vendor/payments,admin/commerce,admin/financials,admin/referrals}/**"
---
# Money: what to know

Owner: `money-owner`. Proof: `verify-money`. Every money change also gets the `reviewer` agent (opus) and `/security-review`.

- **Two lifecycles.** `booking_requests.status` is the request; `payment_status` is money. Only the payments slice writes `payment_status`, and always with a conditional `.eq("payment_status", expected)` write.
- **Held funds.** Checkout pays Eventtz; the vendor is paid by an explicit `Transfer` only. That is what lets disputes block payouts. Never Stripe-call inside a shared read path.
- **Idempotency keys on every Transfer and Refund.** Keys in use: `{id}-upfront`, `refund-{id}-deposit`, `refund-{id}-deposit-remainder`. A new money call without a key is a bug.
- **Webhooks** (`payments/README.md`): HMAC over `"{t}.{raw body}"`, 300s skew, empty secret never verifies. Each event id is claimed in `stripe_webhook_events` first; a handler failure is 503 plus full rollback so Stripe redelivers.
- **Tiered client cancels.** `cancelled` + `partially_refunded` with `cancellation_refund_percent` set means the preset split the money (`bookings/domain_cancellation.py`). The vendor share is a Transfer at cancel time, held (`cancellation_payout_at IS NULL`) until Connect setup is done.
- **Terms snapshot (ADR 0010).** `start_checkout` copies report window, split percent, delivery deadline, deposit and cancellation policy onto the booking (`domain_policy.checkout_terms_columns`). Later vendor edits never touch a paid booking.
- **Terms numbers live twice**: `web/lib/policyConstants.json` and `bookings/domain_policy.py`; `tests/unit/test_policy_constants.py` keeps them equal. Change both.
- **Split payouts.** Every photography booking paid from 2026-10-17 is split (first part 50-60%, default 60%, 30 days). `payout_stage` is derived, never stored; `payment_status` stays `paid` after the first Transfer.
- **Money is integer pence inside `domain.py`**; format only at the edge. Never trust client prices: list prices come from `vendors.payload`, quotes from the vendor's own lines.
- **Referral discount** comes off the service fee only, is capped at the fee, never touches the vendor's portion (`pricing`, `referrals` READMEs). A vendor's client code never changes once set. Paid bookings report the discount stored at payment.
- **Goldens are oracles.** `api/tests/golden/` holds byte-exact money maths from the old backend. Never edit a fixture to make a test pass; a diff means money changed, so say so.
- **Tests use fakes** from `tests/support/fakes.py`, never `patch("app.…")`, never live Stripe. Live-mode transfers are "ask first".
- **Orphaned Connect accounts**: only an explicit "no such account" marks one orphaned; a 403 is a key mismatch. With payout history, onboarding stops with `stripe_connect_restore_required`.

## What a failure looks like here
- A double charge, refund or transfer: a missing idempotency key, or a non-conditional `payment_status` write that loses a race.
- A client-supplied amount, percent or code reaching a price or a refund without re-derivation on the server.
- A paid booking whose terms change after the fact (snapshot skipped, or live vendor settings read instead of the booking columns).
- `policyConstants.json` and `domain_policy.py` drifting, or a golden fixture edited to go green.
- A webhook that acts before claiming its event id, swallows a failure as 200, or verifies with an empty secret.
- Money rounded or summed in floats, or discount applied to the vendor's portion.
- A money list screen that filters or totals the rows of one fetched server page client-side (chip `.filter(`, a KPI `rows.filter(...).length`): page 2, counts and `total` are wrong. Send the filter to the server (`payment_status` takes a comma-separated set on both booking lists, unknown values refused with `booking_invalid_payment_status`) and read counts from the server; `web/lib/noClientListPagination.test.ts` flags `.filter(` on page state. The vendor payout-history response is frozen by `acceptance/test_payments.py` (exact keys), so a new aggregate there needs that test updated first.
- The vendor payout-history response carries `next_release_event_date` / `next_release_label` (earliest-event held payout over the whole ledger) and the referral partner list carries `active_total`: page-only KPIs come from the server, never from the current page's rows. The frozen exact-keys test in `acceptance/test_payments.py` lists both.
