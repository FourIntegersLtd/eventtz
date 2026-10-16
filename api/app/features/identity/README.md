# identity

## Purpose

Who a user is: accounts, sessions, passwords, email verification and account settings
(ADR 0003). The `users` table holds the password hash (argon2) and the profile (type,
staff role, suspension, verification, preferred name, contact sharing). A session is a
15-minute access token sent as `Authorization: Bearer`, plus a 30-day refresh token kept
as a hash in `refresh_tokens`, grouped into `refresh_chains`. The API sets no cookies.
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
- As a **client or vendor**, I **close my own account** after re-entering my password
  (`service_deletion.py`). It is refused while a booking has money in flight, while an
  accepted booking has not happened yet, or while a problem report is open, in that
  order. Otherwise my pending unpaid enquiries are cancelled (the other side is told),
  my personal rows are erased or redacted, a vendor listing is wiped and hidden, every
  sign-in ends, my uploads and Stripe Connect account are deleted and I get an email.
- As a **client**, I **finish first-visit onboarding** and set the name vendors see.
- As a **vendor**, I **see my clients' names** (`client_display_names`) without their email.
- As **staff**, I **see a user's email** (`emails_by_id`) on admin screens.
- As the **staff slice**, I **create, promote, and email a one-click
  setup/reset link to an admin account** (`service_staff_accounts.py`), so the
  team console never touches `users` or the token tables directly.

## Invariants

- Clients and vendors cannot sign in until their email is verified; staff never verify.
- A suspended or closed account is refused at sign-in, after the password check, so the
  refusal never tells a stranger which state an account is in. An unknown address and a
  wrong password get the same error and take the same time.
- Passwords imported from Supabase are bcrypt; one is rewritten as argon2 at that
  account's next successful sign-in (ADR 0003).
- Each refresh spends its token and issues the next in the same chain. Presenting a spent
  token again revokes the whole chain (`RefreshTokenReused`). Sign-out ends the presented
  chain, or every chain when none is named; a password reset or change ends every chain.
- One-click tokens (verify, reset) are stored only as SHA-256 hashes, work for an hour
  and once; issuing a new one voids the account's unused ones.
- "Forgot password" and "resend verification" answer the same whether or not the
  account exists.
- Sign-in, password changes, emails and link clicks are rate limited per account and per
  IP (the `Limit`s in `service_accounts.py`), counted in Redis so every replica shares
  them. Without Redis the limits are off; when Redis errors, sign-in, password changes and
  reset links refuse rather than let requests through.
- Staff password events go in the audit log; every password change emails the user.
- User-facing copy and error messages match the baseline verbatim (the web app shows
  them as-is); errors carry stable `code`s.
- A vendor-facing name is never an email: deleted accounts show "Deleted user", then
  the preferred name, then a name made from the email's local part, then "Client".
  `tests/golden/referrals/client_names.json` pins this.
- Closed accounts are tombstones, never deleted or restored: `users.deleted_at` is set
  and the personal columns wiped. Sign-up with the same email creates a new row.
- Account closure's database writes share the request's transaction; the outside
  clean-up (storage, email, Stripe) is best-effort and never undoes the closure.
- A suspended client or vendor cannot close their account (`CurrentUser` refuses them
  first), a baseline quirk frozen by the acceptance suite. Staff cannot self-close.
- Admin accounts created with no password (`service_staff_accounts.create_admin_account`)
  get `password_hash=None` and a one-click setup link instead of the baseline's
  throwaway Supabase password; the setup link reuses the same
  `password_reset_tokens` machinery as a normal reset, with `purpose="setup"`.

## Routes

| Method | Path | Who |
|---|---|---|
| POST | `/auth/signup` | anyone |
| POST | `/auth/signin` | anyone |
| POST | `/auth/signout` | anyone (ends the presented refresh token's session) |
| POST | `/auth/refresh` | refresh token (body) |
| GET | `/auth/me` | signed-in user |
| POST | `/auth/forgot-password` | anyone |
| POST | `/auth/reset-password` | reset link holder |
| POST | `/auth/resend-verification` | anyone |
| POST | `/auth/verify-email` | verification link holder |
| POST | `/auth/change-password` | signed-in account (suspended too) |
| GET, PUT | `/user/contact-settings` | signed-in user |
| POST | `/user/account/deletion` | signed-in client or vendor (not suspended) |
| GET, PATCH | `/client/onboarding` | signed-in client |

## Deferred

- Mixpanel profile delete on account closure (needs an analytics port; awaiting approval).
