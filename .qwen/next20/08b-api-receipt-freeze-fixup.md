# Piece 08b — api: receipt freeze fix-up after review of 9810759 (MONEY: reviewed)

First read `.qwen/next20/rules-api.md` and follow it in full. Mainline includes 9810759. Commit only your own paths.

Review result: piece 08 matches the baseline.
- Templates are byte-identical to the baseline's.
- The three email goldens were rendered again with the **baseline** `EmailService.send_receipt_email`. Subject, html and text are byte-identical.
- The hook sites, recipients and dedupe (claim before render) match.
- The builders email a fresh payload, as the baseline does.
- `make ci`: 5483 passed. Acceptance `TARGET=api`: 717 passed, 8 xfailed.

Two things are left, plus one item carried over from piece 08.

## 1. A database error in the freeze can undo the money write
`freeze_after_checkout` and `freeze_after_payout` run inside the caller's transaction. The callers are:
- `service_payments_checkout.py:384`
- `service_payments.py:383`
- `service_admin_recovery.py:196`

Each caller wraps the freeze in `try/except Exception`. A Python error is fine. A **database** error is not: statement or lock timeout, or a lost connection in `update_booking` or `get_booking_for_receipt`. It leaves the Postgres transaction aborted. Then:
- At checkout, the webhook handler's savepoint rolls back `payment_status = paid`, although Stripe has taken the money.
- At payout, the `payout_released` write rolls back after the Stripe Transfer was made.

The rule in piece 08 was: "A failed email must never fail the money operation."

Fix:
- Add `receipt_freeze_savepoint(session)` to `bookings/repository_receipts.py`. It returns `session.begin_nested()`, with a docstring saying why. Copy `payments/repository.py:29` `webhook_handler_savepoint`.
- Run the whole freeze and its emails inside that savepoint. The simplest place is inside `freeze_after_checkout` / `freeze_after_payout`, so the three callers stay as they are.
- A failure rolls back to the savepoint only. The callers keep their `try/except` and `log.warning`.
- Test it without `patch("app.…")`:
  - Make a DB statement fail inside the freeze. For example, pass a snapshot the column rejects, or use a fake that runs `SELECT 1/0` through the session.
  - Then assert that `finalize_checkout_session` returns True, `payment_status == "paid"` and `paid_at` is set.
  - Assert that the session still works: a later `select` succeeds.
  - Add the same test for `release_vendor_payout`: `payment_status == "payout_released"`.
  - Run each test once **without** the savepoint and confirm it fails. Say so in the report.

## 2. Imports inside functions
There are local imports:
- `from app.features.bookings import service_receipts` inside the `try` in `service_payments.py` and `service_payments_checkout.py`;
- the identity / notifications / vendors imports inside `freeze_after_*`.

`service_admin_recovery.py` imports `service_receipts` at the top of the file. Do the same everywhere. If a real import cycle stops that, keep the local import and add a one-line comment naming the cycle (AGENTS.md: comment any *why*).

## 3. Carried over from piece 08, not done: `api/scripts/seed_local_admins.py`
- It sets `"deleted_at": None` on an existing profile, which restores a closed account. AGENTS.md says closed accounts are tombstones.
- If the profile has `deleted_at`, print "<email> is a closed account; remove it from the local DB first", exit 1, and don't touch it.
- Give `_require_local_database`, `_upsert_admin` and `_main` one-line docstrings.
- Make it a separate commit: `api: seed-admins never restores a closed account (ws16)`.

## Allowed paths
- `api/app/features/bookings/**`
- `api/tests/**`
- `api/scripts/**`

## Done
- `make ci` exits 0.
- Restart `make serve TARGET=api`, then `make test TARGET=api` gives 717 passed and 8 xfailed.
- Two commits, both with the Cursor trailer:
  - `api: receipt freeze runs in a savepoint so it never undoes a payment (ws12)`
  - `api: seed-admins never restores a closed account (ws16)`
- Report in 10 lines or fewer:
  - both hashes;
  - the test counts;
  - which DB failure you injected;
  - that the test failed without the savepoint;
  - whether there was an import cycle.
