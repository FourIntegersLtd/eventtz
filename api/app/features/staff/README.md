# staff

## Purpose

Everything about the people who run Eventtz: the admin team, the client
directory staff manage, the audit trail of what they did, and the fixed
test-send screen for checking email templates render. Mirrors
`backend/app/features/admin/` (`team_admin_commands.py`, `client_admin_commands.py`,
`audit.py`, `admin_email.py`).

## Use cases

- As **another slice**, I **record a staff action** (a blog post published, a
  vendor approved) so that super admins can see who changed what, and when.
- As a **super admin**, I **invite a new admin** by email, either with a
  password I set or with a one-click link they use to set their own. With a
  password set they get the team invite email instead of a link (a brand-new
  account also gets the admin welcome email), as on the baseline.
- As a **super admin**, I **promote an existing client or vendor** to admin the
  same way, without losing their client/vendor history.
- As a **super admin**, I **change an admin's role or suspend them**, but never
  myself, and never the last super admin.
- As a **super admin**, I **remove someone from the team**: deleted outright if
  nothing else references their account, otherwise demoted back to vendor or
  client (never both) so the data they created stays intact.
- As a **super admin**, I **send an existing admin a fresh password-reset
  link**.
- As **staff**, I **browse and search the client directory**, and see each
  client's booking count.
- As **staff**, I **suspend or unsuspend a client** account.
- As **staff**, I **read the audit trail**, in full or narrowed to one
  category (bookings, clients, vendors, disputes, reviews, chat, financials,
  team), and open one entry.
- As a **super admin**, I **send a test email** from a fixed template list, to
  check what a real recipient would see.

## Invariants

- Recording an audit event never fails the action it records: a failed insert is
  logged and swallowed, exactly as the baseline does.
- Audit rows are append-only; nothing in the API edits or deletes them.
- `users` is owned by the identity slice; the team and client consoles read and
  write it through a `sqlalchemy.table()` handle in `repository.py` (the same
  pattern `bookings/repository_admin.py` uses for `dispute_cases` and
  `vendors`), never through identity's ORM model.
- A super admin can never demote or suspend themselves, and can never delete
  themselves or the last remaining super admin — enforced in `service_team.py`
  before any write.
- Deleting a team member checks, in order: a `vendors` row (demote to vendor),
  then any client-side activity that a RESTRICT foreign key would block
  (bookings, reviews, conversations, disputes — demote to client), then a hard
  delete. This mirrors the baseline's `_hard_delete_admin_user` precedence.
- `PATCH /admin/clients/{user_id}/suspended` writes no audit entry, matching
  the baseline (`client_admin_commands.py`); only the email side effect is
  deferred (no caller in this rebuild yet).
- An unrecognised audit-log `category` answers an empty page, like the
  baseline, rather than erroring.
- The staff slice may only call other slices through their `service*`
  modules; creating and promoting admin accounts goes through
  `identity/service_staff_accounts.py`, which owns the one-click setup/reset
  link machinery.

## Routes

- `GET /admin/team` — the team roster (any staff account).
- `POST /admin/team/invite` — create, promote, or top up an admin's password
  (super admin only).
- `POST /admin/team/{user_id}/send-reset-link` — email a fresh reset link
  (super admin only).
- `PATCH /admin/team/{user_id}` — change role and/or suspension (super admin
  only).
- `DELETE /admin/team/{user_id}` — remove or demote a team member (super admin
  only).
- `GET /admin/clients` — search and page through the client directory (any
  staff account).
- `PATCH /admin/clients/{user_id}/suspended` — suspend/unsuspend a client (any
  staff account).
- `GET /admin/audit-log` — a page of the audit trail, optionally by category
  (any staff account).
- `GET /admin/audit-log/{entry_id}` — one audit entry (any staff account).
- `GET /admin/email/templates` — the fixed test-send template list (super
  admin only).
- `POST /admin/email/test-send` — send one test email (super admin only).
