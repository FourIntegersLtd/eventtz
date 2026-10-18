---
name: verify-bookings
description: How to prove a change to bookings works (request lifecycle, quotes, date changes, disputes, reviews, admin booking tools). Use before calling any bookings, disputes or reviews change done. Money files of bookings/ (payments, cancellation split, receipts) are money-owner's: use verify-money for those.
---

# Verify bookings

Pick the **lowest level that can see your change**, run it, and report the command and its result.

| Your change | Minimum proof |
|---|---|
| A domain rule, copy, schema, date bound | Level 1 |
| A status transition, repository write, job, dispute or review rule | Level 1 with the DB tests actually run (count skips) |
| A route's response shape, status code or error `code` | Level 1 + Level 2 on that file |
| A booking, dispute or review screen | Level 1 (web) + Level 3 as the role that sees it |

## Level 1: tests (~30 s, needs Postgres on :5434)

```bash
cd api && make db-up   # skip if `docker ps` shows eventtz-api-postgres-1 on :5434
poetry run python -m pytest -q -rs \
  tests/http/test_bookings_admin.py tests/http/test_bookings_admin_recovery.py \
  tests/http/test_bookings_date_change.py tests/http/test_bookings_maintenance.py \
  tests/http/test_bookings_reminders.py tests/http/test_disputes_realtime.py \
  tests/http/test_review_submitted_event.py tests/repository/test_booking_writes.py \
  tests/unit/test_bookings_admin_date_bounds.py tests/unit/test_bookings_domain.py \
  tests/unit/test_bookings_jobs.py tests/unit/test_reviews_domain.py \
  tests/golden/test_booking_copy_goldens.py tests/golden/test_client_no_response_golden.py
make guards            # AST architecture guards (includes ownership)
cd ../web && export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" \
  && npx vitest run features/bookings features/vendor/bookings lib/bookingEnquireSubmit.test.ts lib/bookingServiceFee.test.ts
```

API: 1073 passed, 0 skipped on 2026-10-18. Web: 15 files, 64 passed on 2026-10-18.
Golden tests are byte-exact: a diff is a change in what users see, so say so, never update the fixture.
A new route or path change also needs `make parity` (baseline paths must not disappear).

## Level 2: acceptance (frozen baseline behaviour)

```bash
cd acceptance && make serve        # leave running (api on :8001)
make test ARGS="test_bookings_client.py test_bookings_vendor.py test_disputes.py test_reviews.py"
```

`ARGS` goes straight to pytest (add `-k name`). Comments marked `BASELINE QUIRK` pin odd shapes
(404 vs 400 vs 403, 200 on a missing review): a failure there is a behaviour change, not a stale test.

## Level 3: the running app

`cd api && make dev` (:8001, add `make worker` for jobs), `cd web && npm run dev` (:3001).
- Client: enquire, see the booking, cancel, open a dispute, leave a review on a completed booking.
- Vendor: accept/decline a request, send a quote, propose a date change.
- Admin (`/admin/bookings`, `/admin/trust`): recovery tools, dispute triage, hide a review.
Then read the stored row: `booking_requests.status` and `payment_status` (bookings must not have changed the latter),
`booking_notifications` (one per booking and kind), `dispute_cases`, `booking_reviews.hidden_at`, `admin_audit_logs`.

## Traps
- DB tests **skip silently** without Docker: read the `-rs` skip list and the "N skipped" count; zero skipped is the bar.
- Check pytest's **exit code**, not the tail. Use `poetry run python -m pytest`, not `poetry run pytest` (stale shebang).
- Docker hung: create a fresh DB on the compose Postgres and set
  `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<name>`.
- The shell has no Node: export the nvm PATH above. Web has no `ci` script; lint has inherited errors.
- Never email real users from a local run (local auth mode logs links); outside services are off.
- Cancellation, payment and receipt tests (`test_bookings_cancellation_domain.py`, `test_bookings_domain_financials.py`, `test_bookings_payments_domain.py`) belong to money-owner.
