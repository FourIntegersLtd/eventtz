---
paths:
  - "api/app/features/{identity,staff}/**"
  - "api/app/core/{auth,rate_limit}.py"
  - "api/scripts/seed_local_admins.py"
  - "web/app/(auth)/**"
  - "web/app/api/v1/**"
  - "web/app/admin/(portal)/{audit,team,email}/**"
  - "web/features/{auth,settings}/**"
  - "web/features/admin/{audit,clients,email,team}/**"
  - "web/lib/{auth-api,auth-interceptors,adminPermissions,adminRole,backend-url}.ts"
  - "web/lib/platformSession*.ts"
---
# Access: what to know

Owner: `access-owner`. Proof: `verify-access`. Every access change also gets the `reviewer` agent (opus) and `/security-review`.

- **Platform-issued JWTs, argon2 passwords** (ADR 0003). Imported Supabase passwords are bcrypt and are rewritten as argon2 at the next successful sign-in; delete the bcrypt path once none remain.
- **The browser never sees a token.** `web/app/api/v1/[...path]/route.ts` proxies to `api/`; `web/lib/platformSession.ts` keeps the access and refresh pair in httpOnly cookies (`eventtz_at`, `eventtz_rt`). `api/` itself sets no cookies and takes Bearer tokens.
- **Refresh chains.** Each refresh spends its token and issues the next. Presenting a spent token revokes the whole chain (`RefreshTokenReused`). Password reset or change ends every chain.
- **Sign-in leaks nothing.** Unknown address and wrong password give the same error in the same time. Suspended or closed accounts are refused only after the password check.
- **Email verification**: clients and vendors cannot sign in unverified; staff never verify.
- **One-click tokens** (verify, reset, staff setup) are stored as SHA-256 hashes only, single use, one hour; issuing a new one voids unused ones. "Forgot password" and "resend verification" answer identically for unknown accounts.
- **Rate limits** (`core/rate_limit.py`, `Limit`s in `identity/service_accounts.py`) are per account and per IP, counted in Redis. Without Redis they are off; when Redis errors, sign-in, password changes and reset links refuse (fail closed).
- **Closed accounts are tombstones** (`users.deleted_at`, personal columns wiped); never restore one on upsert. A suspended client or vendor cannot close their account (frozen baseline quirk); staff cannot self-close.
- **Local auth mode** logs reset URLs instead of emailing them. Never enable it outside local.
- **Staff roles**: `super_admin` vs `admin`. A super admin cannot demote, suspend or delete themselves, nor delete the last super admin (`staff/service_team.py`). The web gate `web/lib/adminPermissions.ts` is cosmetic: the API must enforce the same rule.
- **Audit rows** are append-only; recording one never fails the action. Staff password events are audited and every password change emails the user.
- **Staff creating admins** goes through `identity/service_staff_accounts.py` only (setup link with `purpose="setup"`, `password_hash=None`).
- Errors carry stable `code`s and copy matches the baseline verbatim. Never email real users to test (see memory: no emails without explicit OK).

## What a failure looks like here
- An endpoint reachable without the principal guard, or a web-only permission check with no matching API check.
- Sign-in, reset or verify responses that differ between existing and unknown accounts (enumeration, timing).
- A token, refresh chain or reset link that survives a password change, suspension or closure.
- A rate limit that silently turns off when Redis errors, or is keyed per IP only.
- A token or secret exposed to browser JS, logs, URLs or an unproxied response.
- A tombstoned or suspended account restored, or a super-admin safeguard bypassed.
