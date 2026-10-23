---
paths:
  - "api/app/features/{messaging,notifications,realtime}/**"
  - "api/app/core/{mail,sse,events,redis}.py"
  - "api/app/adapters/{resend_mailer,http_webhooks}.py"
  - "api/tests/**/test_{realtime_,email_after_commit,events_redis,messaging_,notifications_,sse,stream_tickets,notification_}*.py"
  - "acceptance/test_{messaging_,notifications}*.py"
  - "web/app/api/realtime/**"
  - "web/app/{client,vendor}/(portal)/{messages,notifications}/**"
  - "web/app/admin/(portal)/messages/**"
  - "web/features/{chat,notifications}/**"
  - "web/features/admin/{chat,messages}/**"
  - "web/lib/{chatApi,chat-messages,useRealtimeSse,realtimeBus,realtimeHooks,realtimeSseProxy,notificationsFeedApi}*"
---
# Messaging, notifications, realtime: what to know

Owner: `comms-owner`. Proof: `verify-comms`. Review: `quality-reviewer` always.

- **Never send or trigger an email to a real user without the user's explicit OK on that exact email.** Local runs use the log/local mode; tests use the fake mailer.
- **Email leaves only after commit** (`core/mail.py`, `tests/unit/test_email_after_commit.py`): services get an `AfterCommitMailer`; a rollback sends nothing, a post-commit failure is logged, never a 500. Only `ImmediateMailerDependency` routes report the provider's answer.
- **Email links point at the public site** (`https://www.eventtz.com`), never `FRONTEND_URL` or localhost. Alert recipients come from `ADMIN_ALERT_EMAILS`.
- **One notice per (booking, kind)**, unique across users. A notice for both sides needs a `vendor_*` kind: add it to migration 0007's check constraint and to `domain_booking_copy.py`, or the second insert is silently dropped. Copy is pinned by `tests/golden/notifications/booking_copy.json`.
- **No em dashes in user-facing copy** (`test_copy_has_no_em_dash`, `web/lib/noEmDash.test.ts`). Templates are copied verbatim from the baseline and pinned byte for byte by the goldens.
- **SSE fans out over Redis** (ADR 0005, `core/events.py`); without Redis the in-process bus works on one replica only. Publish after commit; frames carry an event name, never user data.
- **Event names are a public contract with `web/`**: `booking_changed`, `chat_unread_changed`, `booking_notifications_changed`, `dispute_changed`. Renaming one breaks `web/lib/useRealtimeSse.ts`.
- **Streams authenticate by a 60-second `typ="stream"` ticket** (`POST /realtime/stream-ticket`); a bad one is `401 invalid_stream_ticket`. The stream never holds the request transaction.
- **Threads**: only participants see or post; someone else's thread is 404 on GET, 403 on mark-read, 400 on send (pinned quirk). Clients may DM only publicly listed vendors (`vendors.service_listing`).
- **Unread** is messages from others after the reader's cursor, using the database clock. Support user reads with `client_last_read_at`; all staff share `admin_last_read_at`.
- **Staff messages** are sanitised HTML (`domain_sanitize`), 5000 visible and 15000 stored characters; every staff action writes a `chat.*` audit event. Only a super admin may broadcast; an admin edits only their own messages.
- **Notifications**: marking another user's notice read is 200 `{"success": false}`; the feed has no caps: `repository_bookings.feed_lines` unions notices and disputes and filters, orders (time, id) and pages in SQL; the unread-chat summary is the last item, counted in `total`. A support email never fails the send.
- **Feed topics follow the stored notice `kind`**, via `NOTICE_KIND_TOPICS` in `domain_feed.py`, never the copy's wording. A new kind needs a row there (`test_every_stored_notice_kind_has_a_deliberate_topic` fails otherwise). The `bookings` topic shows every notice and dispute (payments overlap, as in the baseline); `payments` is `kind IN PAYMENT_NOTICE_KINDS`.
- `booking_requests` and `dispute_cases` are read through table handles in `repository_bookings.py`, not their models.

## What a failure looks like here
- An email sent before commit, sent on a rolled-back request, or sent to a real address from a test or local run.
- A two-sided notice reusing one kind, so the second user's row is dropped by the unique constraint.
- A realtime event published before commit, with payload data, or renamed without the web hook; behaviour that only works on one replica.
- A thread or notification of another user readable, markable or postable (wrong status code or no participant check).
- Unread badge drift: cursor compared with the app clock instead of the database clock, or not refreshed after mark-read.
- A feed filter or total applied after truncating to a page or cap in Python (older matches vanish, `total` stops at the cap): filter and page in SQL.
- A feed filter or badge that matches English words in title/body, so editing copy changes who sees what.
- Staff HTML stored unsanitised, or a staff action with no audit event.
