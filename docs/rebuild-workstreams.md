# Rebuild workstreams: what is left to port, split for parallel agents

Written 2026-09-26 at commit `68be605` on `rebuild/osce-architecture`.
Each section below is a self-contained brief for one agent. Give an agent **section 0 plus
its own section**. Sections in the same wave can run at the same time without editing each
other's files. A later wave needs the earlier sections it names to be merged first.

State at the time of writing:
- `api/` serves 100 of the baseline's 178 routes. The other 78 are listed under their owning section.
- `make ci`: 3,710 tests pass (ruff and mypy clean).
- The acceptance freeze is green on the baseline. `TARGET=api` passes everything outside
  `acceptance/conftest.py` → `NOT_YET_ON_API`.
- `web/` does not exist yet.

| Wave | Sections | Can start |
|---|---|---|
| 1 | S0 harness, 1 Payments, 2 Admin bookings & financials, 3 Reviews, 4 Disputes, 5 Planner & client events, 6 Copilot & vendor AI, 7 Admin team/clients/audit/email, 8 Admin dashboards & directory, 9 Realtime SSE, 10 Web foundation, 11 Autopilot | now (S0 first; it takes about 15 minutes) |
| 2 | 12 Payments cut 2 (receipts & statements), 13 Account deletion, 14–16 Web portals, 17 Cut-over tooling | after the sections they name merge |
| 3 | 18 Integration & loose ends | after everything else |
| — | Phase E cut-over itself | **human-run, ask first** |

---

## 0. Rules every workstream follows (read first)

**Read before writing code:**
- `AGENTS.md` (the repo rules)
- `api/CONTRIBUTING.md` (the slice template)
- `docs/adr/*.md`
- `docs/domain-rules.md`
- the README of any slice you touch

The approved plan is `~/.claude/plans/i-want-you-come-agile-quokka.md`. The reference
architecture is the OSCE Guide repo at `~/Documents/Projects/OSCE Guide/`:
`backend/platform-api` and `platform-web`. Read it, never edit it, and **never open its
`serviceAccountKey.json`**.

**Safety (non-negotiable)**
- Work only on a branch off `rebuild/osce-architecture`, ideally in your own git worktree.
  Commit locally.
- Never push or deploy. Never touch the hosted Supabase DB. Never run `.cursor/start.sh`.
- Never edit `backend/` or `frontend/`. Read them as the behaviour reference, and never run a formatter over them.
- Never read `backend/.env`, `frontend/.env.local` or `acceptance/.env.local`, and never commit secrets.
- Never commit real customer data: emails other than `@example.com`, or real user UUIDs.
  Never copy the baseline's `QA_CLIENT_VENDOR_VISIBILITY` default or `ADMIN_NOTIFY_RECIPIENTS` into `api/`.
- Never commit `supabase/.branches/`, `supabase/.temp/`, `acceptance/.run/` or `acceptance/.env.local`.
  Stage explicit paths and scan `git diff --cached` for secrets, emails and UUIDs.
- Ask the user first for:
  - new Poetry or npm dependencies
  - new migrations against any hosted DB
  - deleting routes
  - any live-mode Stripe call
  - force-push
- Commit messages end with the co-author line the user's tooling specifies.

**Method (TDD, freeze first)**
1. If the routes you port have no acceptance tests, write them in `acceptance/test_<area>.py`.
   They must go green against the **baseline** first (`make serve` in `acceptance/`, then
   `make test ARGS=test_<area>.py`). Commit them, then add them to `NOT_YET_ON_API` as strict xfail.
2. Build in `api/` until `TARGET=api` passes. Then delete your lines from `NOT_YET_ON_API`:
   the entries are strict, so passing tests fail the run until the line is removed.
3. Money maths is checked against goldens captured from the baseline: `make capture` in
   `acceptance/`, into `api/tests/golden/`.

**Slice shape and guards (all enforced in `api/tests/guards/`)**
- **Files:** `README.md` (Purpose, Use cases, Invariants, Routes), `domain*.py` (pure, no I/O),
  `models.py`, `repository*.py` (the only place for SQL and model imports; may flush, never commit),
  `service*.py` (never commit or flush), `schemas*.py`, `errors.py`, `router*.py` (thin), and optionally `jobs.py`.
- **Imports:** a slice imports only another slice's `service*`, `schemas`, `errors` or `jobs`.
  `core` never imports a feature. To read another slice's table, use a
  `sqlalchemy.table()`/`column()` handle in your own repository (see `bookings/repository.py`).
- **Sessions:** use `from app.core.db import SessionDep, as_uuid, plain_row, plain_value`.
  Only `core/db.py` and `core/jobs.py` commit.
- **Errors:** raise an `AppError` subclass (`InvalidInput` 400, `Unauthenticated` 401,
  `Forbidden` 403, `NotFound` 404, `Conflict` 409, `Unavailable` 503) with a stable `code`,
  keeping the baseline's exact message text. Never raise `HTTPException`.
- **Routes:** every route has `response_model` (unless it returns 204 or a streaming/plain
  response) and `responses=error_responses(...)` with at least one status ≥400.
  Paths and methods must match `api/openapi.baseline.json`.
- **Auth:** use the principals from `app.core.auth`: `CurrentClient`, `CurrentVendor`,
  `CurrentStaff`, `CurrentSuperAdmin`, and `ROLE_ERRORS`.
- **Ports:** outside services go through `app.core.ports` (Mailer, Storage, LanguageModel,
  PaymentGateway, …). Tests inject fakes from `api/tests/support/fakes.py`; `patch("app.…")` is banned.
- **Style:**
  - descriptive names only, never single letters, even in comprehensions
  - a docstring on every module, class and function
  - %-style log calls through `log = get_logger(__name__)`
  - money as integer pence inside `domain.py`
  - ruff line length 110, mypy strict

**Shared files: small appends only, resolved at merge**

| File | What you may do |
|---|---|
| `api/app/main.py` | Add your router(s) to `_routers()` and your adapter to `_plug_in_adapters`. One line each. |
| `acceptance/conftest.py` | Delete only your own `NOT_YET_ON_API` lines (or add new ones for a new freeze file). |
| `api/app/core/settings.py`, `api/.env.example` | Append settings in your own clearly labelled block. |
| `api/app/core/ports.py`, `api/tests/support/fakes.py` | Append a new `# --- <area> ---` section. Do not change existing ports. |
| `api/openapi.json` | **Do not commit it.** The integrator regenerates it with `make openapi` after merging. |
| `api/alembic/versions/` | Only for real schema changes. Use your **reserved revision number** from the table below and set `down_revision` at merge time. |
| Another slice's files | Not yours. If you need a new service function there, say so in your hand-off note; do not add it yourself unless your section says so. |

Reserved Alembic numbers: 1 Payments `0004`, 3 Reviews `0005`, 4 Disputes `0006`,
5 Planner `0007`, 6 Copilot `0008`, 7 Admin team `0009`, 9 Realtime `0010`, 13 Account deletion `0011`.
Most sections need **none**: the baseline schema is already in `0002`.

**Running in parallel on one machine.** Section S0 makes the harness take a port and a
database name per worktree. Until S0 merges, only one agent at a time may run `TARGET=api`
acceptance. The baseline server on `:8000` can be shared: it is read-only code over local Supabase.

**Useful commands.** From `api/`:
- `make db-up`
- `make ci` (check `$?`, and check that the db tests ran and were not skipped)
- `make openapi`

From `acceptance/`:
- `TARGET=api ../api/.venv/bin/python -m pytest -q -p no:cacheprovider`
- lint: `../api/.venv/bin/ruff check --config ../api/pyproject.toml .`

Node for `web/`: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`.

**Done means:**
- `make ci` exits 0
- your `TARGET=api` acceptance tests pass, and the baseline run stays green
- the running server was exercised for your routes
- your slice README is updated
- a hand-off note at the end of your branch's last commit message lists anything you left for another section

---

## S0. Parallel-run harness (wave 1, do first, small)

**Goal:** let several worktrees run `TARGET=api` acceptance at once.

**Owns:** `acceptance/scripts/serve.sh`, `acceptance/Makefile`, and the README section of `acceptance/` if one exists.

**Change**
- `serve.sh api` reads `API_PORT` (default 8001) and `API_DB_NAME` (default `eventtz`).
- It runs `createdb` on the compose Postgres if that database is missing, migrates it, then serves on that port.
- Document running the suite as:
  `BASE_URL=http://127.0.0.1:$API_PORT ACCEPTANCE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/$API_DB_NAME TARGET=api …`
  (conftest already reads both variables).
- Suggest one port and database per section, e.g. section N uses `:81NN` and `eventtz_wsN`.

**Done:** two servers on different ports and databases pass `test_content_help.py` at the same time.

---

## 1. Payments: checkout, webhooks, payouts, refunds, maintenance (wave 1)

**Goal:** make `acceptance/test_payments.py` pass for everything except the admin routes
(section 2 owns those) and receipts (section 12). This takes over the two 503 placeholders in bookings.

**Owns**
- **Bookings slice, new files:** `service_payments*.py`, `repository_payments.py`,
  `schemas_payments.py`, `router_admin_recovery.py`, `jobs.py`
- **Bookings slice, edits:** `service_completion.py`, `service_status.py` (cancel paths),
  `service_common.py`, `errors.py` (append), `router_client.py` (checkout routes),
  `router_vendor.py` (error lists), `README.md` (Deferred section)
- **New slice** `api/app/features/payments/`
- **Already committed in `68be605`, extend as needed:** `adapters/stripe_payments.py`,
  the payments block of `core/ports.py`, `FakePaymentGateway`

**Must not touch:** `router_admin.py`, `repository_admin.py`, `schemas_admin.py` (section 2).

**Routes**
- `POST /api/v1/client/booking-requests/{booking_id}/checkout`
- `POST /api/v1/client/booking-requests/{booking_id}/checkout/sync`
- `POST /api/v1/webhooks/stripe`
- `POST /api/v1/vendor/payments/connect-account`
- `GET /api/v1/vendor/payments/status`
- `GET /api/v1/vendor/payments/history`
- Admin recovery, in `bookings/router_admin_recovery.py`, prefix `/admin/bookings`, super admin only:
  - `POST {id}/sync-payment`, `POST {id}/release-payout`, `POST {id}/retry-payout`
  - `POST {id}/complete-cancellation`, `POST {id}/cancel-on-behalf`
  - `POST {id}/confirm-completion`, `POST {id}/run-maintenance`

**Baseline to read**
- `backend/app/features/bookings/`: `payment_checkout.py`, `payment_finalize.py`,
  `payment_completion.py`, `payment_maintenance.py`, `payment_refunds.py`,
  `booking_payment_helpers.py`, `payout_history.py`, `booking_funnel_timestamps.py`
  (`mark_payment_requested`, `mark_refunded`), `status*.py` (cancel + refund)
- `backend/app/features/payments/`: `stripe.py`, `http/*.py`, `messages.py`
- `backend/app/features/admin/booking_recovery.py`
- `backend/app/jobs/` (the hourly loop)
- `backend/app/features/notifications/copy.py`

**Design already decided**
- Money flows live in the **bookings** slice (`service_payments*.py`), to avoid a
  bookings↔payments import cycle. The `payments` slice holds:
  - the vendor routes, the webhook router and Connect sync (calling bookings services)
  - a pure `domain.py`: webhook HMAC and pence conversion
  - `stripe_webhook_events` (either map it in `payments/models.py` and remove it from
    `UNMAPPED_BASELINE_TABLES` in `core/db.py`, or use a table handle)
- **Webhook**
  - No header → 400 "Missing Stripe-Signature header." (`missing_stripe_signature`).
  - Verify in pure code: parse `t=` and `v1=`, compute
    `hmac_sha256(secret, f"{t}.{raw_body}")`, compare with `compare_digest`, allow 300 s of
    tolerance; an empty secret always fails. Failure → 400 "Invalid signature.".
  - Once the signature is valid, **always** return `{"success": true}`, and log handler exceptions.
  - Handle only `checkout.session.completed` and `account.updated`.
  - Dedupe by `INSERT (id, type) … ON CONFLICT DO NOTHING`, and skip the event if nothing was inserted.
- **Checkout** (keep the baseline order and messages)
  1. Load the booking for this client, else 400 "Booking not found.".
  2. Status must be accepted, else "Only accepted bookings can be paid.".
  3. Payment status must be unpaid or pending, else "This booking has already been paid.".
  4. The vendor must be charges-ready (account and charges enabled), or have the admin
     listing waiver (`listing_override`), else `VENDOR_PAYOUTS_NOT_READY`.
  5. The vendor must have a bookable payload, else "This vendor is not available for booking right now.".
  6. Re-price on the server with `service_pricing` and store the snapshot.
  7. The client total must be above 0, else "Nothing to pay for this booking.".
  8. An event address is required, else `ADD_EVENT_ADDRESS_BEFORE_PAY`.
  9. `gateway.create_checkout_session`:
     - metadata: booking_id, vendor_user_id, client_user_id, and the amounts to 2 dp
       (client_total_gbp, vendor_amount_gbp, service_fee_gbp, referral_fee_discount_gbp)
     - `success_url` = `{frontend}/client/bookings/{id}?payment=success&session_id={CHECKOUT_SESSION_ID}`
     - `cancel_url` = `…?payment=cancelled`
     - `customer_email` = the client's email
  10. Store the session id, set `payment_status=pending`, mark payment requested, and record
      the `customer_started_payment` event.
- **Finalize from a session** (webhook and sync):
  - Booking not accepted, or a stale session id → refund with suffixes
    `stale-checkout-not-accepted` / `stale-checkout-session`.
  - `amount_total` must equal the metadata client total in pence.
  - Conditional update to paid: `status=accepted AND payment_status IN (pending, unpaid)`.
  - Then send the notices `payment_received` (client) and `vendor_payment_received` (vendor),
    both `send_email=False`, record `customer_payment_completed`, and announce the change.
  - Receipt snapshots and emails are section 12; leave a clearly named hook.
- **Sync**
  - Paid, payout_released, refunded or partially_refunded → return as is.
  - Stripe says the session is missing (`resource_missing`) → clear the session, then 400 "That payment link has expired…".
  - Metadata booking mismatch → "This checkout session does not match this booking.".
  - Metadata client mismatch → "…your account.".
  - Session not paid → "Payment has not finished processing yet. Wait a moment and refresh.".
- **Refund**
  - Idempotency key `refund-{booking_id}-{suffix}`; the suffix is `cancel-{party}`, `full` or `partial`.
  - Conditional `payment_status=paid` → refunded or partially_refunded.
  - Send the client a `payment_refunded` notice.
  - When the refund fails: admin alert, then "We couldn't process the refund right now. Please try again shortly."
  - Cancelling a pending booking expires its `cs_` session (best effort).
  - Cancelling a paid booking refunds **first**, then cancels.
- **Payout release** (replaces `PayoutReleaseNotRebuilt` in `service_completion._finalize`):
  - Vendor not payout-ready → the `payout_held_connect_incomplete` notice (already written).
  - `vendor_amount_gbp` ≤ 0 → admin alert, then `PAYOUT_AMOUNT_MISSING`.
  - The source charge is the stored `ch_`, else the payment intent's `latest_charge`.
  - Check for an existing transfer in group `booking_{id}` before creating one.
  - Transfer idempotency key: `transfer-{booking_id}-{amount_pence}-{destination}[-src-{charge}]`.
  - Transfer failure → admin alert, then `PAYOUT_RELEASE_FAILED`.
  - Conditional update to completed + payout_released.
  - Then: the `booking_completed` event, the `booking_completed` client notice
    (insert_if_absent), and the `vendor_payout_released` vendor notice (`send_email=False`).
  - Also, after the **first** party confirms, run the post-event step. The baseline does
    this; api currently skips it.
- **Maintenance** (procrastinate periodic tasks in `bookings/jobs.py`, hourly, limit 50):
  - completion reminders
  - automatic payout release after `booking_payout_auto_release_hours_after_event`,
    skipped for an active dispute or `support_hold`
  - retrying bookings where both parties confirmed but the payout is still `paid`
  - The baseline also marks stale enquiries and sends enquiry and lifecycle reminders
    (`enquiry_reminders.py`, `lifecycle_reminders.py`, `mark_stale_enquiries_no_response`). Port those too.
  - List views send reminders only, capped at 10.
- **Contract section 4 (disputes) will call.** Add both functions early and keep their signatures:
  ```python
  # api/app/features/bookings/service_payments.py
  async def refund_booking_for_staff(session, mailer, gateway, *, booking_id: str,
                                     amount_pence: int | None) -> BookingRow: ...
      # None = full refund (suffix "full"), else partial (suffix "partial");
      # body "Your payment for this booking was refunded.\n\nIt should reach your card
      # within 5-10 working days, depending on your bank."
  async def release_payout_for_staff(session, mailer, gateway, *,
                                     booking_id: str) -> ConfirmCompletionResponse: ...
      # payment_status must be "paid", else "Only paid bookings can have their payout released."
  ```
- **Connect onboarding** (vendor routes):
  - Retrieve the existing account. If it is orphaned and has payout history →
    503 `stripe_connect_restore_required`. If it is orphaned without history → clear the
    fields, audit `vendor.stripe_connect_cleared`, and recreate it.
  - Prefill the account from the vendor payload: name, a +44 phone, the address, `businessName`.
  - Safe return paths: `/vendor/payments`, `/vendor/onboarding`→`/vendor/payments`, `/vendor/bookings/{id}`.
  - Stripe platform not activated → 503 `stripe_connect_unavailable`.
  - `account.updated` syncs the flags for the vendor with that account id.
- Remove `CancelNeedsPayments` and `PayoutReleaseNotRebuilt`, their error lists in both
  routers, and the notes about them in `service_common.py` and the README.

**Freeze:** `acceptance/test_payments.py` (the non-admin, non-receipt tests). Remove
`"test_payments.py::*"` from `NOT_YET_ON_API` and re-add narrower patterns for the tests sections 2 and 12 own.

**Unit tests:** HMAC (valid, stale, tampered, empty secret), pence rounding, idempotency keys,
and finalize/refund/payout against `FakePaymentGateway`.

---

## 2. Admin bookings list, detail, diagnostics and financials (wave 1)

**Goal:** the staff views of bookings, plus the simple (non-Stripe) admin writes.

**Owns** (bookings slice, new files): `router_admin.py`, `repository_admin.py`,
`schemas_admin.py`, `service_admin*.py`, `domain_financials.py`. Also appends to `errors.py`.

**Routes**
- `GET /admin/bookings`: filters and search, offset/limit, total, and a needs-attention scan over up to 400 rows
- `GET /admin/bookings/{id}`: detail and diagnostics; writes a `booking.view` audit row
- `PATCH /admin/bookings/{id}/payment-fields`: super admin only
- `POST /admin/bookings/{id}/reset-checkout`
- `PATCH /admin/bookings/{id}/support-hold`
- `GET /admin/financials/summary`
- `GET /admin/financials/export.csv`: super admin only; writes a `financials.export_csv` audit row

**Baseline to read**
- in `backend/app/features/admin/`: `http/platform_bookings.py`, `http/platform_financials.py`,
  `booking_admin_commands.py`, `booking_diagnostics.py`, `booking_payment_patch.py`,
  `booking_recovery.py` (only `admin_clear_checkout_session` and `admin_set_support_hold`),
  `messages.py`, `audit.py`, `permissions.py`

**Notes**
- **Payment-fields patch:**
  - `{}` → "No fields to update".
  - Setting `payment_amount_gbp` without a payment intent id → `STRIPE_PI_REQUIRED_FOR_AMOUNT`.
  - When the patch sets Stripe ids, it verifies them with `gateway.retrieve_payment_intent`
    / `retrieve_charge`. Use the `PaymentGateway` port already in `core/ports.py`; do not add a new one.
- **Audit:** use `staff.record_admin_action(...)` for every audit row.
- **Financials:** compute from stored line items and adjustments plus the service fee, in
  pence, in `domain_financials.py`. Keep the exact disclaimer text. The test expects
  `gmv 157.5, fee 7.5, vendor 150, held 150, released 0.0` for one paid £150 booking.
- **CSV:** `text/csv; charset=utf-8`, `attachment; filename="eventtz-financials.csv"`.

**Depends on:** nothing unmerged. Section 1 writes the recovery routes in `router_admin_recovery.py`.

**Freeze:** the admin list, detail, patch, reset-checkout, support-hold and financials tests in `acceptance/test_payments.py`.

---

## 3. Reviews (wave 1)

**Goal:** a new `reviews` slice.

**Routes**
- `POST /client/booking-requests/{id}/review`
- `GET /client/reviews`
- `GET /vendor/reviews`
- `GET /admin/reviews`
- `GET /admin/reviews/{review_id}`
- `PATCH /admin/reviews/{review_id}/visibility`

**Owns:** `api/app/features/reviews/`.

**Must not touch:** `bookings/`. Bookings, marketplace and explore keep reading
`booking_reviews` through their table handles. If a public-review read belongs in your
service, say so in the hand-off note; section 18 swaps the handles over.

**Baseline to read**
- `backend/app/features/bookings/reviews.py` (stats, featured snippets, client/owner lists, `create_booking_review`)
- `backend/app/features/admin/review_admin_commands.py`, `http/platform_trust.py`
- the review image handling in `media`

**Freeze:** `acceptance/test_reviews.py` (25 tests). Remove `"test_reviews.py::*"` from `NOT_YET_ON_API`.

**Notes**
- Keep the reviewer display rules (the display derived from email) and the visibility states.
- Review images go through the existing `Storage` port.
- Do not edit identity's account-deletion storage code (section 13 does that).

---

## 4. Disputes (wave 1; the money branch is finished after section 1 merges)

**Goal:** a new `disputes` slice.

**Routes**
- Client:
  - `GET` and `POST /client/booking-requests/{id}/disputes`
  - `GET /client/disputes`
  - `GET /client/disputes/{dispute_id}`
- Vendor: the same four under `/vendor/…`
- Admin:
  - `GET /admin/disputes`
  - `PATCH /admin/disputes/{dispute_id}`

**Owns:** `api/app/features/disputes/`.

**Must not touch:** `bookings/`. Bookings keeps its `_dispute_cases` table handle and `has_active_dispute`.

**Baseline to read**
- `backend/app/features/bookings/`: `disputes.py`, `dispute_commands.py`
- `backend/app/features/admin/dispute_admin_commands.py` (enrichment, list, patch, the
  assignee check through `team_admin_commands.assert_active_admin_assignee`), `messages.py`

**Money branch:** the admin PATCH `resolution_action`:
- `release_payout` → `bookings.service_payments.release_payout_for_staff`
- `refund_client` → `refund_booking_for_staff(amount_pence=None)`
- `partial_refund` → range-check against the paid amount (`partial_refund_range_detail`), then
  `refund_booking_for_staff(amount_pence=…)`

Those signatures are fixed in section 1. Build everything else first. Write this branch last:
rebase on section 1 once it merges, or leave a failing strict-xfail entry for just those tests.

**Freeze:** `acceptance/test_disputes.py` (34 tests).

**Notes**
- Opening a dispute links or creates the support conversation. Use `messaging`'s services;
  if one is missing, note it for the hand-off.
- Assignee checks read staff roles through `staff`'s service.

---

## 5. Planner routes and client events (wave 1)

**Goal:** finish the `planner` slice. Today it has only models, repository and `service_bookings.py` for bookings.

**Routes**
- `GET` and `POST /client/planner/plans`
- `GET /client/planner/plans/{plan_id}`
- `POST …/{plan_id}/archive`
- `POST …/{plan_id}/ensure-event`
- `POST …/{plan_id}/items/{need_id}/replace`
- `GET /client/events`
- `GET /client/events/{event_id}`

**Owns:** `api/app/features/planner/`. Put client events there too, or in a new
`client_events` slice; say which in the README.

**Must not touch:** the signatures in `planner/service_bookings.py`, which bookings calls.

**Baseline to read:** `backend/app/features/planner/`, `backend/app/features/client_events/`,
and the `ai/` helpers the planner uses.

**Freeze:** `acceptance/test_planner.py` (23 tests). Also add happy-path tests that drive
plan generation through the fake `LanguageModel`: the current freeze mostly covers error paths.

---

## 6. Vendor copilot and onboarding AI (wave 1)

**Goal:** a new `copilot` slice (or `vendor_copilot`).

**Routes**
- `POST /vendor/copilot/ask`
- `GET /vendor/copilot/brief`
- `POST /vendor/copilot/draft-reply`
- `POST /vendor/copilot/review-packages`
- `GET /vendor/copilot/score`
- `POST /vendor/onboarding/ai/analyze-portfolio-image`
- `POST /vendor/onboarding/ai/generate-bio`
- `POST /vendor/onboarding/ai/review-packages`

**Owns:** the new slice folder. The onboarding-AI routes may live there or in `vendors/`
as new files `service_ai.py` / `router_ai.py` (no edits to existing vendors files except
`README.md` and `main.py`).

**Baseline to read**
- `backend/app/features/vendor_copilot/` (context, score, demand, brief cache)
- `backend/app/features/vendors/`: `onboarding_ai.py`, `package_quality.py`
- `backend/app/features/ai/openai_helpers.py`
- `backend/app/features/help/` (keyword article search, already ported in `content`)

**Notes**
- All model calls go through the `LanguageModel` port; tests use the fake. Keep the growth
  score maths pure, with goldens.
- The copilot reads bookings, vendor analytics and help articles through those slices' services.
- If the brief cache needs a new table, it takes reserved revision `0008`. Prefer Redis
  (optional) or no cache over a new table.

**Freeze:** `acceptance/test_ai_onboarding.py` (the `test_copilot_*`, `test_generate_bio_*`,
`test_review_packages_*` and `test_analyze_portfolio_*` entries).

---

## 7. Admin console: team, clients, audit log, email (wave 1)

**Goal:** the staff-management routes. **There are no acceptance tests yet: freeze them first on the baseline.**

**Routes**
- `GET /admin/team`, `POST /admin/team/invite`
- `PATCH /admin/team/{user_id}`, `DELETE /admin/team/{user_id}`
- `POST /admin/team/{user_id}/send-reset-link`
- `GET /admin/clients`, `PATCH /admin/clients/{user_id}/suspended`
- `GET /admin/audit-log`, `GET /admin/audit-log/{entry_id}`
- `GET /admin/email/templates`, `POST /admin/email/test-send`

**Owns:** `api/app/features/staff/` (new router, service and repository files), plus a new
`acceptance/test_admin_team.py`.

**Must not touch:** `identity/` internals. Use identity's services for invites and reset
links; if a service function is missing, add it only in a **new** file
`identity/service_staff_accounts.py` and say so.

**Baseline to read:** in `backend/app/features/admin/`: `team_admin_commands.py`,
`client_admin_commands.py`, `audit.py`, `email_test.py`, `permissions.py`, `http/platform_team.py`, `http/email.py`.

**Notes**
- Super-admin-only rules come from `permissions.py`.
- Invite and reset emails go through `Mailer`; local mode logs URLs.
- Suspension must match identity's suspended-account behaviour.

---

## 8. Admin console: dashboards, analytics, directory, vendor insights (wave 1)

**Goal:** the staff read models. **Freeze first**: there are no acceptance tests for these yet.

**Routes**
- `GET /admin/dashboard-summary`
- `GET /admin/dashboard-metrics`
- `GET /admin/marketplace-analytics`
- `GET /admin/directory/search`
- `GET /admin/vendors/{user_id}/insights`

**Owns:** a new `admin_insights` slice (or new `staff/*_insights.py` files, never files section 7
creates), plus a new `acceptance/test_admin_dashboards.py`.

**Baseline to read:** in `backend/app/features/admin/`: `dashboard_metrics.py`, `dashboard_queries.py`,
`marketplace_analytics.py`, `directory_search.py`, `chat_lookup.py`,
`http/platform_dashboard.py`, `http/platform_directory.py`, `http/vendors.py` (insights).

**Notes**
- These read many tables (bookings, disputes, reviews, vendors, users). Use table handles
  in your own repository with plain aggregate SQL. That also removes the baseline's N+1 PostgREST calls.
- Keep the counting rules, and the vendor visibility helpers from `docs/domain-rules.md`.

---

## 9. Realtime: SSE over the Redis bus (wave 1)

**Goal:** `GET /api/v1/realtime/stream`, per ADR 0005.

**Owns:** a new `core/sse.py` (following OSCE P `core/sse.py`), a stream-ticket issue route, and
a new `api/app/features/realtime/` if routes need a slice.

**Must not touch:** `core/events.py` beyond wiring `publish_after_commit` to the bus.
Slices already queue `publish_after_commit(session, user_topic(id), name)`; do not change callers.

**Design**
- `EventSource` cannot send headers, so it uses a **stream ticket**: a JWT with
  `typ="stream"` and a 60 s lifetime (`STREAM_TICKET_TTL_SECONDS` is already in settings),
  issued to a signed-in user and passed as a query parameter.
- The stream fans out over Redis pub/sub, falling back to an in-process bus without Redis.
- Heartbeats; `stream_session()` / `SessionOpenerDep` for any reads.
- Messages keep the baseline's event names (`booking_changed`, …); the web client depends on them.
- Check the baseline contract in `backend/app/features/realtime/`. If the ticket-issue path
  is new (not in `openapi.baseline.json`), add it under `/api/v1/realtime/`, which the parity guard allows for additions.

**Tests:** publishing after commit reaches a subscriber (with and without Redis); an expired or
wrong-type ticket gets 401. Add an acceptance test if the baseline stream can be frozen (it uses cookies there).

---

## 10. Web foundation, auth and marketing (wave 1)

**Goal:** create `web/`, copying OSCE `platform-web` (plan section 13).

**Stack:** Next 16, React 19, dev on :3001.

**Tiers:** `src/{app,surfaces,domains,capabilities,foundation}` with W's eslint boundaries
(disallow by default) and `no-restricted-imports`; components never call the request helper.

**Owns:** everything under `web/`, except the portal route groups sections 14–16 add later.

**Build**
- `foundation/platform-client`:
  - `platformRequest<T>` over fetch, adding the Bearer token, with `credentials: "omit"`
  - `PlatformError` with `status`, `code`, `details`, `requestId` and `hasCode()`
  - `schema.d.ts` from `npm run api:types` over `../api/openapi.json`
- **Session:**
  - The access token lives in memory and is refreshed 1 minute early, single-flight in the
    tab, with `navigator.locks` across tabs.
  - The refresh token is kept in an httpOnly cookie owned by `web/`'s `/api/session` route handlers.
  - A marker cookie only signals that a session exists.
  - `SessionProvider` loads `/me` and `/me/capabilities`; also build `can()` and `RequireSession`.
- `middleware.ts`: redirects and CSP only.
- UI tokens: port Eventtz's design tokens and `frontend/UI-CONVENTIONS.md` (feedback, mobile, motion, Lottie).
- Formatting, monitoring (Sentry), Mixpanel.
- **Pages:** `(auth)` (login, register, forgot/reset password, verify email) and `(marketing)`
  (home, blog, blog/[slug], compliance pages). URLs must match `frontend/app` exactly.

**Dependencies:** npm packages beyond what OSCE `platform-web` uses need the user's OK.

**Done:** `npm run ci` is green, and the pages render against a local `api/` on :8001 with a
seeded account (sign in, refresh, sign out).

---

## 11. Autopilot / Phase D (wave 1; independent)

**Owns:** `.github/`, `scripts/smoke/`, `docs/runbooks/`.

**Build**
- Dependabot or Renovate: patch/minor auto-merge for `api/`, `web/` and `acceptance/`.
- CodeQL; `pip-audit` and `npm audit` in CI.
- A smoke-test script, run against a base URL: health, a public explore call, sign-in with a
  test account, and a webhook signature rejection.
- Draft Sentry alert rules, and an uptime check for `api`, `worker` and `web`.
- The worker needs a heartbeat, e.g. a periodic procrastinate task that writes a timestamp
  the uptime check reads. That is a new route; flag it to the user.

**Must not:** create cloud resources or secrets. Write the configuration and a runbook for the user to apply.

---

## 12. Payments cut 2: receipts, payment records, payout statements (wave 2, after section 1)

**Routes**
- `GET /client/booking-requests/{id}/receipt` and `…/receipt.html`
- `GET /vendor/booking-requests/{id}/payment-record` and `….html`
- `GET /vendor/booking-requests/{id}/payout-statement` and `….html`
- `POST /admin/vendors/{user_id}/restore-stripe-connect`

**Owns:** new bookings files `service_receipts.py`, `domain_receipts.py`, `router_receipts.py`
and the receipt templates, plus the receipt hooks section 1 left.

**Baseline to read**
- `backend/app/features/bookings/`: `receipts.py`, `receipt_document.py`
- `backend/app/features/email/templates/`
- `backend/app/features/payments/stripe.py` (restore Connect)

**Notes**
- **Snapshot columns:** `payment_receipt_snapshot`, `vendor_payment_record_snapshot`,
  `vendor_payout_statement_snapshot` (already mapped on `BookingRequest`).
- **Error messages:**
  - "No receipt is available for this booking yet."
  - "Unable to verify payment with Stripe. Please try again later."
  - "Payout statement is not available until funds have been released."
- Capture the HTML documents as goldens.

---

## 13. Account deletion (wave 2, after sections 1, 3 and 4)

**Route:** `POST /api/v1/user/account/deletion`.

**Owns:** new identity files `service_deletion.py`, `domain_deletion.py`, `repository_deletion.py`.

**Baseline to read:** `backend/app/features/settings/account_deletion*.py`. It covers:
- gates: open bookings, events not yet over, open disputes
- erasure, and tombstoning `users.deleted_at` (never restored on upsert)
- storage deletion (the review images, the user's prefix)
- the Mixpanel profile delete

**Freeze:** `test_identity_settings.py::test_account_deletion_*`.

---

## 14–16. Web portals (wave 2, after section 10)

Three independent agents, one route group each. They share `web/src/foundation` and
`capabilities` read-only; a new shared piece goes into a new file, flagged at hand-off.

| Section | Route group | Pages (`frontend/app/...`) | Waits for the API of |
|---|---|---|---|
| 14 Client portal | `web/src/app/client/` + `domains/client-*` | dashboard, browse, browse/[userId], bookings, bookings/[id], pay, receipt, contact, disputes (+[id]), favorites, help (+messages/[id]), messages (+[id]), notifications, payments, planner (+[planId]), settings, settings/reviews: 21 | 1, 3, 4, 5, 12 for those pages |
| 15 Vendor portal | `web/src/app/vendor/` + `domains/vendor-*` | analytics, bookings (+[id], payment-record, payout-statement), contact, dashboard, disputes (+[id]), help (+messages), messages (+[id]), notifications, payments, profile, profile/reviews, settings: 18 | 1, 3, 4, 6, 12 |
| 16 Admin portal | `web/src/app/admin/` + `domains/admin-*` | audit (+[id]), blog (+[id]), bookings/[id], commerce, dashboard, directory, email, messages, referrals (+[partnerId]), report-bug, settings, team, trust, trust/reviews/[id]: 17 | 2, 3, 4, 7, 8 |

**Reference:** `frontend/app/**`, `frontend/features/**`, `frontend/lib/*Api.ts` and
`frontend/components/**` (behaviour and copy), rewritten on the tiers. Also:
- API calls go in each domain's `api.ts` through `platformRequest`.
- Branch on `PlatformError.code`, never on message text.
- Live updates come from the section 9 stream.

Build pages whose API is already on `api/` first. For the rest, generate types from the merged `openapi.json` once those sections land.

---

## 17. Cut-over tooling, rehearsed locally (wave 2; the real cut-over is ask-first)

**Owns:** `api/app/migration/` (contained, guarded by `test_migration_is_contained`; nothing imports it) and `docs/runbooks/cutover.md`.

**Build:** `export` / `load` / `verify` / `report`, following plan section "Phase E":
- `export`: data-only `pg_dump` of `public`, plus `auth.users` (id, email,
  encrypted_password → `users.password_hash`, email_confirmed_at → `email_verified_at`)
- `load`: into a database at `alembic upgrade head`
- `verify`: row counts per table, spot checks, and a report of users without a password hash

**Rehearse only** between the **local** Supabase container and a local compose database.
Never point it at a hosted database; the runbook tells the user when and how to do that.

---

## 18. Integration and loose ends (wave 3)

- Merge the branches in wave order. Regenerate `api/openapi.json` (`make openapi`), and
  confirm the route-parity script reports **0 missing** of 178.
- `NOT_YET_ON_API` must be empty; run the whole acceptance suite on both targets.
- Swap the table handles for real service calls where slices now exist:
  - bookings → reviews and disputes
  - marketplace explore → bookings and reviews
  - messaging `repository_bookings.py` → bookings
  - delete the stale "not rebuilt yet" comments
- **Mail after commit:** send `Mailer` calls through a procrastinate job deferred in the
  transaction, so a rolled-back request never emails.
- Fix the testcontainers deprecation warning (`testcontainers.postgres` → the community module).
- Clear the mypy errors in `api/tests/guards`.
- Write `api/CONTRIBUTING.md` if it is still thin. Add `make reset-data` to `AGENTS.md`.
  Update the `AGENTS.md` repo map for the new slices.
- **Security notes for the user**, not fixes:
  - explore rows expose vendor emails
  - the live baseline's explore route breaks with a PostgREST 414 once `deleted_user_ids` grows
- **Speed check:** p50/p95 for explore, the admin vendor list and the booking lists, baseline against api.
- **Stripe test-mode end to end:** checkout → webhook → payout → receipt, with the webhook replayed
  to prove it is applied once. Test keys only, on the user's machine or staging, with the user's go-ahead.
