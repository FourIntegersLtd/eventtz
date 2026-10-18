---
name: verify-access
description: How to prove a change to access works: sign-in, tokens and refresh chains, passwords, email verification, rate limits, account closure, staff roles and permissions, the audit log, the Next auth proxy and session cookies. Use before calling any access change done. Lists the proof each kind of change needs and the traps that make a hole look closed.
---

# Verify access

Pick the lowest level that can see your change, run it, report the command and output.

| Your change | Minimum proof |
|---|---|
| Pure rule (`identity/domain*.py`, principal, rate-limit maths) | Level 1 |
| Route, guard, token or session logic | Level 1 + Level 2 |
| Staff roles, team, audit | Level 1 + Level 2 (`test_admin_team.py`) |
| Next proxy, cookies, `platformSession`, `adminPermissions` | Level 1 (web) + Level 3 |
| Anything that sends mail or a reset link | Level 3 in local auth mode only |

## Level 1: tests (~15s, needs Postgres :5434)

```bash
cd api && make db-up    # Postgres :5434, Redis :6381; without them DB tests skip
poetry run python -m pytest -q -rs \
  tests/http/test_admin_team.py tests/http/test_identity_account_deletion.py \
  tests/http/test_identity_sessions.py tests/http/test_identity_terms.py \
  tests/unit/test_auth_principal.py tests/unit/test_identity_deletion_domain.py \
  tests/unit/test_identity_domain.py tests/unit/test_identity_sessions.py \
  tests/unit/test_rate_limit.py tests/golden/test_account_email_goldens.py \
  tests/golden/test_client_suspended_golden.py
make guards             # AST architecture guards
make arch               # import-linter + alembic check
cd ../web && export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && \
  npx vitest run features/auth/authRouting.test.ts lib/platformSession.test.ts
```

99 passed, 0 skipped (api) and 10 passed (web) on 2026-10-18.

## Level 2: acceptance (black box over HTTP)

```bash
cd acceptance && make serve      # api/ on :8001, leave running
cd acceptance && make test ARGS="test_identity_accounts.py test_identity_session.py test_identity_settings.py test_admin_team.py"
```

Local databases only; mail is switched off. These tests freeze baseline copy and codes.

## Level 3: the running app

1. `cd api && make dev` (:8001), `cd web && npm run dev` (:3001), local auth mode (reset URLs are logged, not emailed). `make seed-admins` creates local staff.
2. Sign in through the browser. In devtools confirm `eventtz_at` and `eventtz_rt` are httpOnly and no token shows in JS, responses or URLs.
3. Curl a protected route without a token (expect 401), with a client token on a staff route (expect 403), and with an admin (not super admin) token on a super-admin route.
4. Reuse a spent refresh token: the whole chain must die. Change the password: older sessions must die.

## Traps
- DB tests skip silently without Docker. Read the `-rs` lines and count skipped. Fallback: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<fresh db>`.
- Check pytest's exit code, not the tail. Use `poetry run python -m pytest`.
- Without Redis the rate limits are off, so a rate-limit test must run with Redis up (:6381).
- A web permission check passing proves nothing; test the API route directly.
- Never email or reset a real user's account to test; local auth mode only.
- Node is not on PATH: export the nvm path first.
