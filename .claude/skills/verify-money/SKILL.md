---
name: verify-money
description: How to prove a change to money works: payments, Stripe Connect, checkout, payouts, refunds, cancellation splits, terms policy, pricing, referrals, receipts and their screens. Use before calling any money change done. Lists the proof each kind of change needs and the traps that make a wrong amount look right.
---

# Verify money

Pick the lowest level that can see your change, run it, report the command and output.

| Your change | Minimum proof |
|---|---|
| Pure domain maths (`domain_*.py`, `pricing`, `referrals` domain) | Level 1 |
| Terms numbers (`domain_policy.py` or `policyConstants.json`) | Level 1 (`test_policy_constants.py` is in it) |
| Route, webhook, checkout, refund or transfer logic | Level 1 + Level 2 |
| Receipt rendering or email | Level 1 + Level 2 (`test_receipts.py`) |
| A screen under `pay`, `receipt`, commerce, referrals | Level 1 (web) + Level 3 |
| Anything real Stripe sees | Level 3 in Stripe TEST mode only |

## Level 1: tests (~35s, needs Postgres :5434)

```bash
cd api && make db-up    # Postgres :5434, Redis :6381; without them DB tests skip
poetry run python -m pytest -q -rs \
  tests/http/test_payments_checkout.py tests/http/test_payments_connect.py \
  tests/http/test_payments_holds_and_chargebacks.py tests/http/test_payments_refunds_payouts.py \
  tests/http/test_payments_restore_connect.py tests/http/test_receipt_freeze_emails.py \
  tests/http/test_receipt_routes.py tests/http/test_terms_money_rules.py \
  tests/unit/test_bookings_cancellation_domain.py tests/unit/test_bookings_domain_financials.py \
  tests/unit/test_bookings_payments_domain.py tests/unit/test_domain_receipts.py \
  tests/unit/test_payments_domain.py tests/unit/test_policy_constants.py \
  tests/unit/test_receipt_stripe_verify.py tests/unit/test_referrals_domain.py \
  tests/unit/test_terms_policy_domain.py tests/golden/test_price_list_goldens.py \
  tests/golden/test_pricing_goldens.py tests/golden/test_receipt_email_goldens.py \
  tests/golden/test_receipt_goldens.py tests/golden/test_referrals_goldens.py
make guards             # AST architecture guards
make arch               # import-linter + alembic check (after a model or schema change)
cd ../web && export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && \
  npx vitest run lib/commercePeriod.test.ts features/client/payments lib/bookingServiceFee.test.ts lib/validation/money.test.ts
```

479 passed, 0 skipped (api) and 31 passed (web) on 2026-10-18. The goldens are oracles from the
old backend: a golden diff means money changed. Say so; never edit a fixture to pass.

## Level 2: acceptance (black box over HTTP)

```bash
cd acceptance && make serve      # api/ on :8001, leave running
cd acceptance && make test ARGS="test_payments.py test_receipts.py test_referral_client_codes.py test_referral_partners.py"
```

Acceptance runs against local databases only, with Stripe switched off.

## Level 3: the running app, Stripe TEST mode only

1. `cd api && make dev` (:8001), `make worker`, `cd web && npm run dev` (:3001). Keys must be `sk_test_`; never put a live key in `.env`.
2. Pay a booking with a Stripe test card. Check the `booking_requests` row: `payment_status`, snapshot columns (`report_window_hours`, `payout_upfront_percent`, `delivery_deadline_days`, `damage_deposit_gbp`), `referral_fee_discount_gbp`, and one row per event in `stripe_webhook_events`.
3. Replay the same webhook (Stripe CLI `stripe events resend`): the row must not change twice.
4. Look at the rendered receipt and payout statement, not just the JSON.

## Traps
- DB tests skip silently without Docker. Read the `-rs` skip lines and count skipped; a green run with skips proves nothing. Fallback: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<fresh db>`.
- Check pytest's exit code, not the tail. Use `poetry run python -m pytest` (stale shebang on `pytest`).
- Node is not on PATH: export the nvm path first.
- No test sends a live webhook or calls live Stripe: say so in the report. A transfer or refund in live mode needs the user's explicit OK.
- Changing a terms number means both `domain_policy.py` and `web/lib/policyConstants.json`.
