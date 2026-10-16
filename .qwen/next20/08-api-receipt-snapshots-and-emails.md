# Piece 08 — api: freeze receipt snapshots and send receipt emails at the 3 money events (MONEY: reviewed)

First read `.qwen/next20/rules-api.md` and follow it in full.
Depends on piece 07, which must be committed: the builders and routes exist.

## Goal
When money moves, the booking's receipt documents are frozen **write-once** into their jsonb columns, and the receipt emails go out, as in the baseline. The columns already exist in the schema (`api/alembic/sql/0002_baseline_schema.sql:528-531,733-754`); **no migration**.

## Baseline reference
- Write-once persisters in `backend/app/features/bookings/receipts.py`:
  - `persist_payment_receipt_snapshots` :489 writes `payment_receipt_snapshot` and `vendor_payment_record_snapshot`;
  - `persist_vendor_payout_statement_snapshot` :526.
- Email context: `receipt_context_for_email`, receipts.py:468.
- Hook sites in the baseline:
  1. Checkout finalize, `backend/app/features/bookings/payment_finalize.py:295-303`: persist the receipt snapshots, then `dispatch_payment_receipts_after_checkout(...)`.
  2. Payout release, `backend/app/features/bookings/payment_completion.py:184-190`: persist the payout-statement snapshot, then `dispatch_vendor_payout_statement_after_release(...)`.
  3. Admin recovery sync, `backend/app/features/admin/booking_recovery.py:182-192`: the same as 1.
- Email kinds and templates: `backend/app/features/email/service.py:105-108`. Read the dispatch functions for recipients, subjects and when each email is skipped.
  - `booking/payment_receipt.html` and `.txt`: to the client.
  - `booking/vendor_payment_record.html` and `.txt`: to the vendor.
  - `booking/vendor_payout_statement.html` and `.txt`: to the vendor.

## api hook sites (confirmed to exist)
1. `api/app/features/bookings/service_payments_checkout.py:279`, `finalize_checkout_session`.
2. `api/app/features/bookings/service_payments.py:313`, `release_vendor_payout`.
3. `api/app/features/bookings/service_admin_recovery.py:178`, `_sync_unsettled`. Delete its comment "Payment receipts are not rebuilt yet (as for checkout)…" at ~line 194.

## What to build
- `bookings/repository_receipts.py`: `freeze_receipt_snapshots(session, booking_id, *, client_snapshot, vendor_record_snapshot)` and `freeze_payout_statement_snapshot(...)`.
  - Write-once means a **conditional UPDATE**: `... WHERE id = :id AND payment_receipt_snapshot IS NULL`. It returns whether it wrote.
  - Don't read-then-write in Python.
- `bookings/service_receipts.py`: `freeze_after_checkout(session, booking_id)` and `freeze_after_payout(session, booking_id)`. They build with `domain_receipts` and call the repository.
- Emails:
  - Port the three templates (html and txt) into `api/app/features/notifications/templates/booking/`, with the partials they include.
  - Add senders in `notifications/service.py`, next to the existing booking senders, following their shape (`OutgoingEmail`, `mailer.send`, delivery log).
  - Subjects and recipients are exactly the baseline's.
- Call the freeze and the email at each of the 3 hook sites, **after** the payment write in the same function, the same order as the baseline:
  - Send the email only when the snapshot was newly written, or match the baseline exactly if it sends regardless: read it.
  - A failed email must never fail the money operation. Catch, log with `log.warning(...)` and continue, as the baseline does.
- Goldens: capture the 3 email bodies (html and txt) from the baseline renderer for one fixed payload each, in `api/tests/golden/receipts/`.
- Tests, with `FakeMailer` and `FakePaymentGateway`:
  - finalize writes both snapshots and sends 1 client email plus 1 vendor email;
  - finalizing the same session twice (webhook replay) writes nothing new and sends nothing new;
  - release writes the statement and sends 1 vendor email;
  - admin sync on an unsettled paid booking writes the snapshots;
  - a mailer that raises still leaves `payment_status` updated.
- Bookings README: add the invariant "receipt snapshots are frozen write-once at checkout finalize, payout release and admin sync".

## Also (from the 07b review)
`api/tests/http/test_receipt_routes.py::test_frozen_client_receipt_skips_live_pricing` asserts only status 200. Nothing shows that the broken line item (`unit_price_gbp: "not-a-number"`) would have made live pricing fail.
- Add a control: the same booking **without** the frozen snapshot must fail (the status the api actually returns; check it).
- In the frozen case, assert the frozen payload body: receipt_number and total_label.
- If the broken line item does not make pricing fail, find input that does, or inject a failing pricing dependency, so the test proves what its name says.

## Also (from the 05b review): `api/scripts/seed_local_admins.py`
- It sets `"deleted_at": None` on an existing profile, which restores a closed account. AGENTS.md says closed accounts are tombstones and must never be restored on upsert. If the profile has `deleted_at`, print "<email> is a closed account; remove it from the local DB first", exit 1, and don't touch it.
- Give `_require_local_database`, `_upsert_admin` and `_main` one-line docstrings (AGENTS.md: every function).
- This adds `api/scripts/**` to this piece's allowed paths. Make it a separate commit: `api: seed-admins never restores a closed account (ws16)`.

## Allowed paths
- `api/app/features/bookings/**`
- `api/app/features/notifications/**`
- `api/tests/**`

## Commit
`api: freeze receipt snapshots and send receipt emails at money events (ws12)`
