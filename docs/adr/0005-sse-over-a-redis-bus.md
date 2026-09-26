# 0005 — Server-sent events fan out over Redis

Status: accepted (2026-09-26). Supersedes "SSE in memory on a single replica".
Source: OSCE Guide `platform-api` ADR 0015.

## Decision
- Chat and notifications stream as SSE. Every frame is a whole read model rebuilt
  from the database, the same shape the matching `GET` returns.
- Events are published after the commit and fan out through Redis pub/sub behind
  `core.ports.EventBus`. Events carry a name only, never user data.
- Without Redis an in-process bus is used, which is correct only on one replica.
- `EventSource` cannot send headers, so a stream authenticates with a 60-second
  ticket (`typ: "stream"`) that `get_principal` refuses for anything else.

## Consequences
- The API can run more than one replica once Redis is configured.
- A stream never holds the request transaction; `stream_session` opens a short one
  per snapshot.
