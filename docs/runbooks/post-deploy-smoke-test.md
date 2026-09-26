# Running the smoke test after a deploy

`scripts/smoke/smoke_test.py` makes four read/write-light HTTP calls against
a running `api` deployment to prove the release is actually serving traffic:
`/health`, a public explore read, a sign-in with a pre-seeded test account,
and a Stripe webhook call with a deliberately wrong signature (which must be
rejected). See the script's own docstring for the exact checks and why each
one exists.

## Prerequisites

- A test client account that already exists (and is email-verified) in the
  target environment's database, for the sign-in check. Do not create this
  with a real customer's email; use an `@example.com`-style address seeded
  specifically for this purpose, the same way `acceptance/support/accounts.py`
  seeds test accounts for the acceptance suite.
- Its email and password available as environment variables — never commit
  them, never put the raw password in a GitHub Actions log. If this is run
  from CI later, store them as repository or environment secrets
  (`SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD`) scoped to a deploy job, not as
  plain workflow-file values.

## Running it

```bash
# Local server (e.g. proving a worktree's changes, as this workstream did on :8111):
python3 scripts/smoke/smoke_test.py --base-url http://127.0.0.1:8111

# Against a real deployment, right after a Railway deploy finishes:
SMOKE_TEST_EMAIL="smoke-test@example.com" \
SMOKE_TEST_PASSWORD="<from your secret manager>" \
python3 scripts/smoke/smoke_test.py --base-url https://api.eventtz.com
```

`BASE_URL` is also read from the environment if `--base-url` is omitted, so
a deploy pipeline can set it once and call the script with no arguments.

## Reading the output

Each check prints `[PASS]`, `[SKIP]`, or `[FAIL]` with a one-line reason.
`[SKIP]` is expected, not a problem, in two cases:
- the sign-in check, if `SMOKE_TEST_EMAIL`/`SMOKE_TEST_PASSWORD` are not set
  for that run
- the webhook-signature check, until the payments slice's webhook route
  ships on `api/` (it returns 404 today; the baseline's behaviour, and what
  this check will require once the route exists, is a 400 — see
  `backend/app/features/payments/http/webhooks.py`)

The script exits `0` only if nothing that ran actually failed. A deploy
pipeline can treat a non-zero exit as "roll back" or "page on-call",
whichever the team prefers; this workstream only wrote the check, not the
rollback policy.

## What this workstream proved

Run against a local `api/` server on `:8111` (a worktree-only port reserved
for this workstream; see `AGENTS.md`/`docs/rebuild-workstreams.md` §11), with
migrations at head and no seeded test account yet:

```
Smoke testing http://127.0.0.1:8111/

[PASS] health: 200 OK
[PASS] public explore: 200, 0 vendors
[SKIP] sign-in: SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD not set; skipping
[SKIP] webhook signature rejection: route not deployed yet (404); skipping until payments webhooks land on api/

smoke test: OK
```

Then, having signed up and verified one throwaway `@example.com` client
account directly in that worktree's database (and deleted it again
afterwards — nothing here was committed or left running):

```
Smoke testing http://127.0.0.1:8111/

[PASS] health: 200 OK
[PASS] public explore: 200, 0 vendors
[PASS] sign-in: 200 OK
[SKIP] webhook signature rejection: route not deployed yet (404); skipping until payments webhooks land on api/

smoke test: OK
```

And, with a deliberately wrong password, to prove the check actually fails
loudly rather than always passing:

```
[FAIL] sign-in: expected 200, got 401
...
smoke test: FAILED
```
(exit code 1)
