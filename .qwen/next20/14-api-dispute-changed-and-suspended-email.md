# Piece 14 — api: publish `dispute_changed`, and email a client when they are suspended

First read `.qwen/next20/rules-api.md` and follow it in full. There are no dependencies; this can run any time.

## Part A — `dispute_changed` realtime event

### Facts
- The pattern already used:
  - `api/app/features/bookings/service_common.py:28`: `publish_after_commit(session, user_topic(user_id), BOOKING_CHANGED)`;
  - `messaging/service_chat.py:213`.
- Names live in each slice's `domain.py`: `BOOKING_CHANGED` at `bookings/domain.py:34`, `CHAT_UNREAD_CHANGED` at `messaging/domain.py:34`.
- `publish_after_commit` is in `app/core/events.py`. It's flushed after commit by `core/db.py`, so nothing is sent if the request rolls back.
- The web already listens for `dispute_changed` (`web/src/domains/notifications/NotificationsListView.tsx`; grep `dispute_changed` in `web/src`).

### Baseline
- On open: `backend/app/features/bookings/disputes.py:383-390` publishes to both booking parties.
- On admin patch: `backend/app/features/admin/dispute_admin_commands.py:300-323`. The logic is asymmetric: read exactly who gets notified on each kind of change (status, assignee, resolution) and copy it.

### Build
- `disputes/domain.py`: `DISPUTE_CHANGED = "dispute_changed"`, with a comment naming the web listener.
- `disputes/service_participant.py:37` `open_dispute`: after the insert, publish to the client and vendor user ids of the booking.
- `disputes/service_admin.py:108` `patch_dispute`: publish to the recipients the baseline picks, after the write.
- Tests (http or service), using the in-process bus the realtime tests use (see `api/tests/**/test_realtime*`):
  - opening a dispute delivers `dispute_changed` to both parties' topics;
  - a patch delivers to exactly the baseline's recipients;
  - a failed request (e.g. a validation error) delivers nothing.
- Disputes README: add a Realtime line.

## Part B — email the client when an admin suspends them

### Facts
- api: `api/app/features/staff/service_clients.py:37-40`, `set_suspended(session, user_id, *, suspended)`, sends no email. Its docstring and `staff/README.md:53-55` say the email is deferred.
- Baseline: `backend/app/features/admin/client_admin_commands.py:117-143`.
  - The email is sent **only when suspending** (not restoring), and only if the client has a valid email.
  - Subject "Account suspended | {APP_NAME}", headline "Account suspended", template `booking/notification`. Copy the exact body lines from the baseline.
  - A send failure is only logged; the suspension still succeeds.

### Build
- Add `send_client_suspended_email(mailer, *, to, ...)` in `notifications/service.py`, next to the other senders, rendering the existing `booking/notification` template (already ported).
- `staff/service_clients.set_suspended` takes a `mailer`. The router passes `MailerDependency`, as other staff routes do; grep `MailerDependency` in `staff/router*.py`.
  - Read the client's email through the staff repository (or the identity service if that's how staff reads users today).
  - Send only when `suspended=True`. Catch any exception and log a warning.
- Golden: capture the baseline email HTML and text for one fixed name, alongside the existing notification goldens (`api/tests/golden/`).
- Tests:
  - suspend sends one email with the literal subject;
  - restore sends none;
  - a mailer that raises still returns 200 and the flag is set.
- Update the docstring and `staff/README.md`: remove the "deferred" note.

## Allowed paths
- `api/app/features/disputes/**`, `api/app/features/staff/**` and `api/app/features/notifications/**`
- `api/tests/**`

No openapi change is expected. If `make openapi` shows a diff, explain why in the report.

## Commits (two)
1. `api: publish dispute_changed on open and admin patch (ws18)`
2. `api: email clients when an admin suspends them (ws18)`
