# Piece 11 — acceptance: freeze the account-deletion gates and erasure on the baseline

First read `.qwen/next20/rules-api.md` and follow it in full. This piece writes **tests only**; there is no api/ code.

## Facts
- `acceptance/test_identity_settings.py:169-215` already has 4 deletion tests:
  - `test_account_deletion_without_a_session_is_401`
  - `test_account_deletion_with_the_wrong_password_is_400`
  - `test_account_deletion_is_forbidden_for_an_admin_account`
  - `test_account_deletion_happy_path_tombstones_the_account`
- `acceptance/conftest.py:47-51`: `NOT_YET_ON_API` has `"test_identity_settings.py::test_account_deletion_*"`. **Name every new test `test_account_deletion_…`** so the same pattern covers it; the conftest then needs no change.
- Route: `POST /api/v1/user/account/deletion`, body `{password}`. Handler: `backend/app/features/settings/http/routes.py:63-73`.

## Baseline logic to read before writing
- `backend/app/features/settings/account_deletion.py:29-56`: the order of checks.
- `backend/app/features/settings/account_deletion_gates.py`: the three gates.
- `backend/app/features/settings/erase.py`: what is erased and what is kept.
- `backend/app/features/settings/messages.py:5-24`: the exact `detail` and `code` for `money_in_flight`, `active_booking`, `open_dispute`, the admin refusal and the success message.

The order, from the earlier research (check it against the code):
1. load the profile;
2. refuse admins;
3. if already deleted, best-effort cleanup;
4. check the password;
5. gates, in order: money in flight → an accepted booking whose event is not over → an open dispute;
6. the "account deleted" email; capture the vendor's stripe id;
7. cancel the pending and unpaid bookings;
8. erase;
9. tombstone the user;
10. wipe the vendor;
11. best-effort Stripe account delete and Mixpanel delete.

## New tests (in `acceptance/test_identity_settings.py`, after the existing 4)
Seed with the helpers `test_payments.py` uses (`_seed_booking_row` style) or those in `acceptance/support/`; use `@example.com` only.

1. `test_account_deletion_is_blocked_while_money_is_in_flight`: a client with a booking `payment_status="paid"`, event in the future, not paid out. Expect the baseline's status, `code="money_in_flight"` and the exact detail. Then assert the user row is unchanged: `deleted_at` is null and the email is kept.
2. `test_account_deletion_is_blocked_by_an_accepted_booking_before_the_event`: `status="accepted"`, unpaid, event in the future. Expect `code="active_booking"`. Check that gate 1 doesn't fire first for this seed; read the gate.
3. `test_account_deletion_is_blocked_by_an_open_dispute`: a booking whose event is over, with an open `dispute_cases` row where the user is a party. Expect `code="open_dispute"`.
4. `test_account_deletion_gates_apply_to_vendors_too`: a vendor with a paid booking in flight gets `money_in_flight`.
5. `test_account_deletion_cancels_pending_unpaid_bookings`: a client with one `pending` unpaid booking deletes successfully. The booking's status afterwards is the baseline's exact value (read `account_deletion.py`; probably `cancelled`).
6. `test_account_deletion_erases_personal_rows`: seed a message sent by the user, a saved vendor, a `booking_notifications` row and a contact submission. After deletion:
   - the message body is redacted to the baseline's exact replacement text;
   - the saved vendors, notifications and contact submissions for that user are gone;
   - the booking row still exists, with its notes redacted.

   Only assert tables that exist on both targets; check `api/alembic/sql/0002_baseline_schema.sql`.
7. `test_account_deletion_tombstone_is_not_restored_by_signup`: after deletion, signing up again with the same email creates a **new** user id; the old row keeps `deleted_at`.
8. `test_account_deletion_suspended_account_may_delete`: a suspended client can still delete (200).
9. `test_account_deletion_vendor_listing_is_wiped`: a deleted vendor has `payload = {}`, cleared stripe fields and a hidden listing override; exact values from the baseline's erase code. They no longer appear in `GET /api/v1/explore/vendors` (or the public explore path; check the acceptance marketplace tests for it).

Assert status, `code` and exact `detail` literally. Read and write rows through `admin_db` so it works on both targets.

## Steps
1. `cd acceptance && make serve` (baseline :8000).
2. `make test ARGS="test_identity_settings.py -k account_deletion"` until all 13 pass on the baseline; check the exit code.
3. If api :8001 is up: `make test TARGET=api ARGS="test_identity_settings.py -k account_deletion"`. All 13 must xfail strictly, with no XPASS.

## Allowed paths
- `acceptance/test_identity_settings.py`
- `acceptance/support/**` (a helper only if needed)

## Commit
`acceptance: freeze account deletion gates, erasure and tombstone (ws13)`

In the report, include each gate's exact code and detail as the baseline returned it. Piece 12 relies on them.
