# identity

## Purpose

Who a user is: accounts, sessions, passwords, email verification and account settings,
on top of Supabase Auth. Supabase holds credentials and sessions; the `users` table holds
the profile (type, staff role, suspension, verification, preferred name, contact sharing).
Other slices name people through `client_display_names` and `emails_by_id`.

## Use cases

- As a **client or vendor**, I **sign up** so that I can book or be booked; I get a
  verification link by email and sign in after following it.
- As a **user**, I **sign in and out**, and my session **refreshes** without re-entering
  my password.
- As a **user**, I **reset a forgotten password** from an emailed link, and I am signed
  in with the new password; every other session ends.
- As a **user**, I **change my password** while signed in; every session ends, including
  this one, and I sign in again.
- As a **user**, I **choose what contact details I share** after a paid booking.
- As a **client**, I **finish first-visit onboarding** and set the name vendors see.
- As a **vendor**, I **see my clients' names** (`client_display_names`) without their email.
- As **staff**, I **see a user's email** (`emails_by_id`) on admin screens.

## Invariants

- Clients and vendors cannot sign in until their email is verified; staff never verify,
  and accounts with no `users` row predate verification and count as verified.
- A suspended or closed account is refused at sign-in, and the session Supabase just
  opened is revoked.
- One-click tokens (verify, reset) are stored only as SHA-256 hashes, work for an hour
  and once; issuing a new one voids the account's unused ones.
- "Forgot password" and "resend verification" answer the same whether or not the
  account exists.
- Sign-in, password changes, emails and link clicks are rate limited in memory per
  account and per IP (`domain_limits.py`); each worker counts separately.
- Staff password events go in the audit log; every password change emails the user.
- User-facing copy and error messages match the baseline verbatim (the web app shows
  them as-is); errors carry stable `code`s.
- A vendor-facing name is never an email: deleted accounts show "Deleted user", then
  the preferred name, then a name made from the email's local part, then "Client".
  `tests/golden/referrals/client_names.json` pins this.
- Account deletion is not here yet; it arrives once bookings, disputes, messaging,
  planner and payments are rebuilt (it has to check and clean up all of them).

## Routes

| Method | Path | Who |
|---|---|---|
| POST | `/auth/signup` | anyone |
| POST | `/auth/signin` | anyone |
| POST | `/auth/signout` | anyone (ends this browser's session) |
| POST | `/auth/refresh` | refresh token (body or cookie) |
| GET | `/auth/me` | signed-in user |
| POST | `/auth/forgot-password` | anyone |
| POST | `/auth/reset-password` | reset link holder |
| POST | `/auth/resend-verification` | anyone |
| POST | `/auth/verify-email` | verification link holder |
| POST | `/auth/change-password` | signed-in account (suspended too) |
| GET, PUT | `/user/contact-settings` | signed-in user |
| GET, PATCH | `/client/onboarding` | signed-in client |
