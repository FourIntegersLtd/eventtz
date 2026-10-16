# Piece 08c — api: take the test hooks out of the receipt freeze (after review of 6687ef3)

First read `.qwen/next20/rules-api.md` and follow it in full. Commit only your own paths. Small piece.

Review result:
- The savepoint is right. `receipt_freeze_savepoint` wraps the whole freeze and its emails, the callers keep their `try/except`, and the imports are now at the top of the files.
- 36993a1 (seed-admins tombstone) is right.

One problem: the failure test works through **test hooks in production code**:
- `repository_receipts.savepoint_test_force_sql_error_booking_id`, a module global that tests set, and `_maybe_inject_savepoint_test_db_error`, which runs on every real freeze;
- the `_use_savepoint` keyword on `freeze_after_checkout` / `freeze_after_payout`, plus the `_freeze_after_*_body` split that exists only for that keyword.

This is `patch("app.…")` in disguise (AGENTS.md "Never do"), and a private function called across modules.

## Fix
1. Delete from `app/`:
   - the global;
   - `_maybe_inject_savepoint_test_db_error` and both calls to it;
   - the `_use_savepoint` parameter;
   - the `text` import, if nothing else uses it.
   Fold the `_freeze_after_*_body` functions back into `freeze_after_checkout` / `freeze_after_payout`, as `async with repository_receipts.receipt_freeze_savepoint(session):` around the existing body.
2. Cause the database error **from the test, in the database**:
   - In the test (inside its transaction, so it rolls back), create a trigger function and a `BEFORE UPDATE` trigger on `booking_requests` that runs `RAISE EXCEPTION 'receipt freeze blocked'`. Use `WHEN (NEW.payment_receipt_snapshot IS DISTINCT FROM OLD.payment_receipt_snapshot)`, or `vendor_payout_statement_snapshot` for the payout test.
   - Put the DDL in a small test helper in `tests/support/`, not in `app/`.
   - Then run `finalize_checkout_session` / `release_vendor_payout` and assert:
     - it returns True / the completion state;
     - `payment_status` is `paid` / `payout_released`;
     - the snapshot column is still NULL;
     - a later `SELECT 1` through the same session works.
3. The control, without touching `app/`: with the same trigger, call `repository_receipts.freeze_receipt_snapshots` directly outside any savepoint. Assert that it raises and that the next statement fails with `InFailedSQLTransaction` (or SQLAlchemy's wrapper for it). This proves the trigger really aborts a transaction, so the savepoint test proves something.
4. Before committing, remove the `async with receipt_freeze_savepoint` line locally once and confirm the two savepoint tests fail. Put it back and say so in the report.

## Allowed paths
- `api/app/features/bookings/**`
- `api/tests/**`

## Done
- `grep -rn "savepoint_test\|_use_savepoint\|_maybe_inject" api/app` finds nothing.
- `make ci` exits 0.
- Commit `api: receipt freeze test fails the database, not a hook in app code (ws12)` with the Cursor trailer.
- Report in 5 lines or fewer.
