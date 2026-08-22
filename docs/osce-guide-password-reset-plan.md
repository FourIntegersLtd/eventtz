# Plan: OSCE Guide one-click forgot-password (Eventtz pattern)

**Target:** [OSCE Guide](file:///Users/yahayakenny/Documents/Projects/OSCE%20Guide)  
**Reference:** Eventtz `backend/app/features/auth/password_reset.py` + Resend email + `/reset-password?token=…`  
**Related (separate):** `docs/email-resend-templates-handoff.md` (SMTP → Resend transport). This plan assumes email send already works (Resend or current transport).

---

## 1. Problem

OSCE Guide today:

| Step | Behavior |
|------|----------|
| Forgot | `POST /api/forgot_password` — Firestore lookup by `email` + `app_type`; **404 if missing** (enumeration) |
| Token | `generate_token(email)` (itsdangerous) emailed as a **code to paste** |
| Email | `reset_password_email.html` + `email_reset_code.html` shows raw `access_token` |
| Reset UI | Manual “Password Reset Token” field on `/auth/reset-password` |
| Reset API | Timed serializer validate → bcrypt → Firestore update |

Eventtz (desired):

| Step | Behavior |
|------|----------|
| Forgot | Always generic success; rate-limited |
| Token | `secrets.token_urlsafe(32)` — store **SHA-256 only**, 60m, single use |
| Email | One-click CTA → `{origin}/reset-password?token={raw}` |
| Reset UI | Token from **query string**; password + confirm only |
| After reset | Mark used; update password; optionally auto sign-in |

---

## 2. Goals / non-goals

### Goals

1. One-click reset link in email (no paste-code UX).
2. Enumeration-safe forgot response.
3. Hashed, expiring, single-use tokens (Eventtz semantics).
4. Keep OSCE multi-exam model: `app_type` ∈ `sca` | `plab` | `ortho` | `casc`.
5. Keep Firestore + bcrypt password storage.
6. Update email template to CTA button (OSCE brand, not Eventtz purple).

### Non-goals

- Supabase Auth recovery emails.
- B2B platform admin “reset password” tooling (unless it already shares this path).
- Admin email preview CMS.
- Full visual redesign of all email templates (only password-reset template + CTA partial as needed).
- Changing Resend/SMTP wiring (use existing `EmailService`).

---

## 3. Architecture (target)

```
ForgotPassword.tsx
  POST /api/forgot_password { email, app_type }
       ↓
  request_password_reset(...)
       · rate limit
       · lookup Firestore user (COLLECTION_MAPPING[app_type])
       · if missing → return GENERIC message (no email)
       · raw = token_urlsafe(32); store sha256(raw) in password_reset_tokens
       · invalidate prior unused tokens for user+app
       · EmailService.send_password_reset_email(reset_url=…)
       · always return GENERIC message
       ↓
  Resend / EmailService
       · reset_password_email.html — button →
         {exam_origin}/auth/reset-password?token={raw}&app_type={app_type}

ResetPassword.tsx
  reads token + app_type from URL
  POST /api/reset_password { token, password, app_type }
       ↓
  reset_password_with_token(...)
       · rate limit; lookup by hash; reject used/expired
       · bcrypt hash; update Firestore user
       · mark token used; invalidate siblings
       · optional: set auth cookie / redirect to login
```

---

## 4. Phased plan

### Phase 0 — Decisions (15 min)

| Decision | Recommendation |
|----------|----------------|
| Token store | New Firestore collection `password_reset_tokens` (mirror Eventtz fields) |
| Reset URL host | Per-exam frontend origin from existing auth URL map (same idea as `SUBSCRIPTION_WELCOME_APP_AUTH_URLS`), path `/auth/reset-password` |
| After success | Prefer redirect to login with success flash; auto-login only if cookie pattern is trivial to reuse |
| API paths | Keep `/api/forgot_password` and `/api/reset_password` to limit frontend churn |

### Phase 1 — Backend token module

**New (suggested):** `backend/b2c/shared/services/password_reset_service.py`  
(Or equivalent under shared services — keep routes thin.)

Port from Eventtz `password_reset.py`:

- `_hash_token`, expiry **60m**, `GENERIC_FORGOT_MESSAGE` (OSCE Guide wording)
- In-process rate limits (email + IP) — same ballpark as Eventtz
- `request_password_reset(email, app_type, client_ip) -> str`
- `reset_password_with_token(token, password, app_type, client_ip) -> …`

**Firestore doc shape** (`password_reset_tokens`):

| Field | Type | Notes |
|-------|------|--------|
| `token_hash` | string | SHA-256 hex; unique |
| `user_id` / `document_id` | string | Firestore user doc id |
| `email` | string | normalized |
| `app_type` | string | exam key |
| `expires_at` | ISO timestamptz | |
| `used_at` | ISO or null | |
| `created_at` | ISO | |

Indexes: query by `token_hash`; list unused by `user_id`/`app_type` for invalidate.

**Wire routes** in `users_route.py`:

- Replace body of `forgot_password` / `reset_password` with service calls.
- Remove reliance on `generate_token` + `URLSafeTimedSerializer` for this flow.
- Stop returning 404 when user not found on forgot.

### Phase 2 — Email

Update `EmailService.send_password_reset_email`:

```text
Args: email, reset_url, expires_minutes=60  (drop access_token-as-code)
```

Update `reset_password_email.html`:

- Short copy + expiry note
- Primary CTA: “Reset password” → `{{ reset_url }}`
- Optional plain-text URL fallback under button
- Do **not** render paste-code block (`email_reset_code.html`) for this email
- Use existing transactional partials / OSCE brand (`#2563eb` if already aligned)

### Phase 3 — Frontend

| File | Changes |
|------|---------|
| `ForgotPassword.tsx` | On success, show generic “check your email” copy; remove “go paste token” link |
| `ResetPassword.tsx` | `useSearchParams` for `token` + `app_type`; remove token text input; if no token, show error + link to forgot |
| Login | Confirm forgot link still → `/auth/forgot-password` |

API payloads stay `{ email, app_type }` / `{ token, password, app_type }`.

### Phase 4 — Hardening & cleanup

- Never log raw tokens in production (local/dev log of full URL OK, like Eventtz local mode).
- Delete or stop using password-reset path through itsdangerous `generate_token` if unused elsewhere.
- Align min password length with login validation.
- Smoke: all four `app_type`s if hosts differ.

---

## 5. File checklist

### OSCE Guide (edit)

```
backend/b2c/shared/routes/users/users_route.py
backend/b2c/shared/services/email_service.py
backend/b2c/shared/services/password_reset_service.py   # new
backend/b2c/shared/templates/reset_password_email.html
frontend/src/b2c/components/shared/auth/ForgotPassword.tsx
frontend/src/b2c/components/shared/auth/ResetPassword.tsx
```

### Eventtz (read-only reference)

```
backend/app/features/auth/password_reset.py
backend/sql/049_password_reset_tokens.sql
backend/app/features/email/templates/auth/password_reset.html
frontend/features/auth/ResetPasswordView.tsx
frontend/lib/auth-api.ts
```

---

## 6. Test plan

1. **Unknown email** — forgot returns 200 + generic message; no email sent.
2. **Known email** — email arrives with button; link includes `token` + `app_type`.
3. **Open link** — reset page has password fields only; token not shown as an input.
4. **Happy path** — new password works on login for that exam.
5. **Reuse token** — second submit fails (“already used” / expired messaging).
6. **Expired token** — fail after 60m (or temporarily shorten expiry in a test build).
7. **Rate limit** — burst forgot requests → “try again later”.
8. **Wrong exam** — user in `sca` but forgot with `plab` → generic message, no leak.
9. **Mobile / Gmail** — button and fallback URL both work.

---

## 7. Acceptance criteria

- [ ] Forgot never reveals whether email/`app_type` exists
- [ ] Email is one-click CTA (no primary paste-code UX)
- [ ] Reset page reads `?token=` (and `app_type`); no manual token field
- [ ] Token: hashed at rest, 60m expiry, single use
- [ ] Password updates correct Firestore collection for `app_type`
- [ ] Rate limits present on forgot + reset
- [ ] End-to-end works with real email send for at least one exam

---

## 8. Prompt for implementing LLM

> Implement Eventtz-style one-click forgot/reset password in OSCE Guide per `eventtz/docs/osce-guide-password-reset-plan.md`. Reference `eventtz/backend/app/features/auth/password_reset.py` and `ResetPasswordView.tsx`. Replace paste-code email + manual token field with SHA-256 token store (Firestore) + email link to `/auth/reset-password?token=…&app_type=…`. Keep Firestore/bcrypt/`app_type`. Enumeration-safe forgot. Update `reset_password_email.html` to a CTA button. Keep `/api/forgot_password` and `/api/reset_password` paths.

---

## 9. Suggested order of work

1. Phase 1 backend service + route swap (can temporarily keep old email args until Phase 2)
2. Phase 2 email CTA
3. Phase 3 frontend query-param reset
4. Phase 4 cleanup + smoke tests across exams
