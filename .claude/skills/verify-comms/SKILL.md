---
name: verify-comms
description: How to prove a change to messaging, notifications, realtime (SSE), email sending or the event bus works. Use before calling any comms change done. Lists the proof each kind of change needs and the traps (emails to real users, silent DB skips, single-replica SSE) that make a green run meaningless.
---

# Verify comms

Pick the **lowest level that can see your change**, run it, and report the command and its output.

| Your change | Minimum proof |
|---|---|
| Domain rule (`domain_sanitize`, unread, feed ordering) | Level 1 |
| Router, service or repository in messaging/notifications/realtime | Level 1 + Level 2 on the matching acceptance file |
| Email template, copy or `domain_booking_copy.py` | Level 1 (goldens pin bytes); a golden diff means copy changed: say so, never edit the fixture to pass |
| New notice kind | Level 1 + migration check constraint (`alembic check`) + a test that both sides get a row |
| `core/mail.py`, `core/events.py`, `core/sse.py`, `core/redis.py` | Level 1 + Level 3 with Redis |
| Web chat/notification screens or SSE hooks | `npm test && npm run build` in `web/` + Level 3 |

## Level 1: tests (~10 s with the Docker services up)

```bash
cd api
make db-up        # Postgres :5434, Redis :6381. Without them DB tests skip and a pass means nothing
poetry run python -m pytest -q tests/http/test_realtime_*.py tests/unit/test_email_after_commit.py \
  tests/unit/test_events_redis.py tests/unit/test_messaging_*.py tests/unit/test_notifications_*.py \
  tests/unit/test_sse*.py tests/unit/test_stream_tickets*.py tests/repository/test_notification_*.py \
  tests/golden/test_notification_goldens.py
make guards
```

44 passed, 0 skipped on 2026-10-18 (Postgres :5434 and Redis :6381 up). Chat and notification HTTP
behaviour is pinned by `acceptance/` (Level 2). The web area has no unit tests; use the web build.

## Level 2: acceptance

```bash
cd acceptance && make serve          # api/ on :8001; leave running
make test ARGS="test_messaging_chat.py test_messaging_admin.py test_notifications.py"
```

## Level 3: the running app

`make dev` (:8001), `make worker`, `npm run dev` (:3001), Redis on :6381 (`REDIS_URL` set). Open two
sessions (client and vendor, or user and admin): send a message in one and see the other's unread
badge and thread update without reload (proves SSE through the Next proxy at `web/app/api/realtime`).
Stop Redis and confirm the in-process bus only works on one replica; do not claim multi-replica without Redis.
Emails go to the log/local mode: read the logged mail, **never configure a real Resend key and never
send to a real address** without the user's explicit OK on that exact email.

## Traps

- DB tests **skip silently** without Docker: the summary's "skipped" count must be 0.
- Check pytest's **exit code**, not the tail. Use `poetry run python -m pytest`.
- Docker hung: fresh database on the compose Postgres and
  `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<name>`.
- A passing test with the fake mailer does not prove the mail is sent after commit: `test_email_after_commit` does.
- One notice per (booking, kind), unique across users: a missing second-side row is a dropped insert, not a UI bug.
- Staff copy and notices must contain no em dashes (`test_copy_has_no_em_dash`).
