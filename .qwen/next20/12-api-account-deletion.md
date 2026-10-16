# Piece 12 — api: `POST /api/v1/user/account/deletion` (erases personal data: reviewed)

First read `.qwen/next20/rules-api.md` and follow it in full.
Depends on piece 11, which must be committed: 13 `test_account_deletion_*` tests, green on the baseline and xfail on api.

## Goal
Every `test_account_deletion_*` test passes on `TARGET=api`, and `NOT_YET_ON_API` becomes **empty** (`NOT_YET_ON_API: dict[str, str] = {}`).

## Baseline reference
- Route: `backend/app/features/settings/http/routes.py:63-73`.
- Order: `backend/app/features/settings/account_deletion.py:29-56`.
- Gates: `account_deletion_gates.py`.
- Erasure: `erase.py`.
- Copy: `messages.py:5-24`.
- Piece 11's report lists the exact code and detail for each gate. Match them.

## Existing api pieces to reuse (don't rebuild them)
- `AnyAccount` at `api/app/core/auth.py:379`. Suspended accounts may delete.
- Password check: identity's `CurrentPasswordIncorrect` and the existing verify function in `identity/service_passwords.py`. Grep for how the password-change route checks the current password, and call the same function.
- Refresh-chain revoke: the revoke-all used on password change in `identity/service_session.py`. Grep `revoke`.
- Open disputes: `disputes.service_participant.list_own_disputes` (:82). It has no status filter, so filter the returned `DisputePublic` list by the open statuses the baseline gate uses. Don't add a new repository query in disputes.
- Mail: follow the pattern of the existing identity emails (`notifications` senders, `FakeMailer`) for the "account deleted" email. Port its template from `backend/app/features/email/templates/` (grep `account_deleted` or the subject in `messages.py`).

## What to build

1. **Storage port.** Add `delete_object(key)` and `delete_prefix(prefix)` to `Storage` in `api/app/core/ports.py`.
   - Implement them in `api/app/adapters/s3_storage.py`. `delete_prefix` lists and then deletes in batches of 1,000, as boto3 needs.
   - Add them to `FakeStorage` in `api/tests/support/fakes.py`, recording the deleted keys.
2. **PaymentGateway.** Add `delete_account(account_id)` to the port, the Stripe adapter and `FakePaymentGateway`. It's best-effort, only if the baseline deletes the Connect account; read the end of `account_deletion.py`.
3. **Mixpanel profile delete: NOT in this piece.** It needs a new port and the user hasn't approved it. Add it to the identity README Deferred list: "Mixpanel profile delete on account closure (needs an analytics port; awaiting approval)."
4. **Bookings service functions**, in `bookings/service_account_closure.py`:
   - `closure_blockers(session, user_id) -> list[...]`: bookings in flight or active for the gates, returning what `domain_deletion` needs. It reads through bookings' own repository.
   - `cancel_open_requests_on_closure(session, user_id) -> int`: the baseline's cancel of pending and unpaid bookings. It sets the exact status and fields the baseline sets, and publishes `BOOKING_CHANGED` to the counterparty the same way `service_common.py:28` does.
5. **Identity:**
   - `domain_deletion.py`: pure gate evaluation, returning the first failing gate in the baseline order.
   - `repository_deletion.py`: the erasure writes.
     - Use `sqlalchemy.table()` handles for tables other slices own. This is an accepted precedent (see `staff/repository.py`).
     - One function per table group, each with a docstring naming the baseline line it mirrors.
   - `service_deletion.py`: `delete_own_account(session, mailer, storage, gateway, *, principal, password)`, in the baseline order.
     - Everything except the gates and the tombstone is best-effort in the baseline. Keep it that way: wrap external calls (S3, Stripe, mail) in try/except, then `log.warning` and continue.
     - Database writes are in the one request transaction, so they're not best-effort.
   - Errors in `identity/errors.py`: `AccountDeletionBlocked` with codes `money_in_flight`, `active_booking` and `open_dispute` (one class per code if that fits the existing pattern better), and `AccountDeletionForbiddenForAdmin`. Status and detail are exactly the baseline's.
   - Schemas `AccountDeletionRequest{password}` and `AccountDeletionResponse` (exact baseline shape; grep `AccountDeletionResponse` in `backend/app/contracts/`).
   - Route in `identity/router_settings.py`: `POST /user/account/deletion` with `AnyAccount`, `response_model` and `error_responses(...)`.
6. **Tombstone.**
   - Set `deleted_at=now`; set `email`, `preferred_name` and `contact_phone` to NULL; set every `share_*` to false; set `email_verified_at` to NULL and `account_suspended` to false. Match the baseline's exact column list.
   - **Never DELETE the row.**
   - Revoke all refresh chains.
   - Add a unit or http test that sign-up with the same email creates a new user id and doesn't touch the tombstone (the AGENTS.md trap).

## Tests
- Unit: `domain_deletion`: each gate, and the order (money beats active, active beats dispute).
- http, with FakeMailer, FakeStorage and FakePaymentGateway:
  - each gate, with literal code and detail;
  - admin 403;
  - wrong password 400;
  - happy path: the tombstone columns are literal; the storage prefix was deleted; the refresh token no longer works (POST refresh gives 401); one email was sent;
  - a storage fake that raises doesn't stop deletion.
- Acceptance: empty `NOT_YET_ON_API`, then run the **full** suite on both targets:
  - `make test` (baseline) is green;
  - `make test TARGET=api` is green with 0 xfail.

  Report both pass counts.
- README: identity Use cases and Routes, plus the invariant "closed accounts are tombstones, never deleted or restored".

## Generated files
Run `make openapi` and `npm run api:types`, and commit both. After this piece, route parity is 177/178, with only `/health` left as a schema-hidden route.

## Allowed paths
- `api/app/features/identity/**` and `api/app/features/bookings/**` (the new closure service file, plus a repository function if needed)
- `api/app/features/notifications/**` (the email template and sender)
- `api/app/core/ports.py`, `api/app/adapters/s3_storage.py` and `api/app/adapters/stripe_payments.py`
- `api/tests/**`, `acceptance/conftest.py`, `api/openapi.json` and `web/src/foundation/platform-client/schema.d.ts`

## Commit
`api: account deletion with gates, erasure and tombstone (ws13)`
