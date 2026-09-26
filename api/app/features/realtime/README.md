# Realtime

## Purpose

Tells a signed-in user's open screens that something changed, instead of them
polling (ADR 0005). Owns the SSE stream route and the stream-ticket route that
authenticates it. The transport (Redis pub/sub, falling back to an
in-process bus) lives in `core.events` and `core.sse`; slices publish through
`core.events.publish_after_commit` and never touch this slice directly.

## Use cases

- A signed-in client, vendor or admin mints a stream ticket, then opens
  `GET /realtime/stream` with it and receives `connected`, followed by a
  named frame (`booking_changed`, `chat_unread_changed`,
  `booking_notifications_changed`, `dispute_changed`, …) each time another
  slice queues one of those events for their topic and its transaction
  commits.
- The browser tab stays open for minutes; the stream sends a heartbeat while
  idle so a proxy or load balancer does not treat silence as a dead
  connection and close it.

## Invariants

- **The stream authenticates by ticket, not by Bearer token.** `EventSource`
  cannot set an `Authorization` header, so `POST /realtime/stream-ticket`
  (any signed-in account) mints a JWT with `typ="stream"` and a
  `STREAM_TICKET_TTL_SECONDS` (default 60s) lifetime; the stream route reads
  it from the `ticket` query parameter. A missing, expired, badly signed or
  wrong-`typ` ticket is `401 invalid_stream_ticket` — an ordinary access
  token does not work here, and a stream ticket does not work as a Bearer
  token, because `typ` differs.
- **Frames carry a name and nothing else** (`core.sse.frame`), matching the
  baseline's `notify_user(user_id, event)` exactly: the client refetches the
  small screen that changed through its own signed-in endpoint. No read
  model is ever assembled or sent here, so this slice never opens a database
  session.
- **Event names are a public contract with `web/`.** They are frozen from
  `backend/app/features/realtime/sse.py`'s callers: `booking_changed`,
  `chat_unread_changed`, `booking_notifications_changed`, `dispute_changed`.
  Renaming one is a breaking change to `frontend/lib/useRealtimeSse.ts`
  (baseline) and its `web/` equivalent.
- **Fan-out is Redis pub/sub when Redis is configured, in-process otherwise**
  (`core.events.get_event_bus`), which this slice does not choose between
  itself — it only asks for the bus and subscribes.
- `POST /realtime/stream-ticket` is not in the baseline (the baseline stream
  authenticates by cookie, so it needs no separate ticket step). It is
  additive under `/api/v1/realtime/`, which is why it was added to
  `openapi.baseline.json` alongside the existing `GET /realtime/stream`
  entry rather than left to fail the route-parity guard.

## Routes

- `POST /api/v1/realtime/stream-ticket` — any signed-in account; mints a
  stream ticket. New in `api/` (see Invariants).
- `GET /api/v1/realtime/stream` — the SSE stream for the ticket's user;
  matches the baseline path.
