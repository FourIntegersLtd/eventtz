# 0003 — Platform-issued tokens, with Supabase passwords imported

Status: accepted (2026-09-26). Supersedes "keep Supabase Auth" (2026-09-25).
Source: OSCE Guide `platform-api` ADR 0004.

## Context
Leaving Supabase means leaving Supabase Auth. OSCE owns `users` and issues its own
tokens; the user wants the same mechanism here. Real vendors and clients already
have passwords, stored by Supabase as bcrypt hashes.

## Decision
- The API issues HS256 access tokens (15 minutes) carrying `sub`, `email`,
  `user_type`, `admin_role`, `email_verified` and `account_suspended`, so most
  authorisation needs no database read.
- Refresh tokens rotate inside a chain (`refresh_chains`, `refresh_tokens`, stored
  as SHA-256 hashes, 30 days). Presenting a spent token revokes the chain.
  Password change or reset revokes every chain.
- Requests carry `Authorization: Bearer`. The API sets no cookies. `web/` keeps the
  refresh token in an httpOnly cookie on its own `/api/session` route handlers and
  the access token in memory. SSE uses a 60-second stream ticket.
- New passwords are argon2. **Imported bcrypt hashes are verified and rehashed to
  argon2 at the next sign-in** (OSCE imported none; everyone there reset). The
  bcrypt path is deleted once no active user still has one.
- `core/auth.py` turns the token into a `Principal`. Routers declare one
  dependency (`CurrentUser`, `CurrentClient`, `CurrentVendor`, `CurrentStaff`), and
  capabilities come from `GET /api/v1/me/capabilities`.
- Eventtz keeps its own email verification, password rules and tombstones; the
  acceptance tests freeze them.

## Consequences
- No auth vendor, and no network call to check who is calling.
- Access tokens cannot be revoked early; suspension takes effect within 15 minutes
  unless a route re-reads the user.
- The acceptance suite's cookie assertions become target-aware (cookies on the
  baseline, bearer on `api/`).
