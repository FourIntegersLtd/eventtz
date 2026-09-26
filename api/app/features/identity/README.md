# identity

## Purpose

Who a user is: accounts, sessions and profiles. This first cut holds only what other
slices need to name people; sign-up, sign-in, settings and account deletion move in
when the identity slice is rebuilt in full (see the plan's slice order).

## Use cases

- As a **vendor**, I **see my clients' names** (`client_display_names`) so that I know
  who booked, without being shown their email address.
- As **staff**, I **see a user's email** (`emails_by_id`) on admin screens such as
  referral sign-ups.

## Invariants

- A vendor-facing name is never an email: deleted accounts show "Deleted user", then
  the preferred name, then a name made from the email's local part, then "Client".
- `tests/golden/referrals/client_names.json` pins the email-to-name rule.

## Routes

None yet. The auth and settings routes arrive with the full identity slice.
