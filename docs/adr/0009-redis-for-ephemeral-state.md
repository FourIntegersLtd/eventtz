# 0009 — Redis holds ephemeral state only, and is optional

Status: accepted (2026-09-26).
Source: OSCE Guide `platform-api` `core/redis.py`, `core/rate_limit.py`.

## Decision
- Redis holds rate-limit counters and the SSE bus. Nothing that must survive a
  restart lives there; jobs live in Postgres (ADR 0008).
- `get_redis()` returns `None` when `REDIS_URL` is unset or `REDIS_DISABLED` is
  true. Rate limits then fail open; sign-in and password reset fail closed if
  Redis is configured but erroring.
- Limits are fixed windows (`INCR` + `EXPIRE`) keyed by the caller: the
  Railway edge's `X-Real-IP` when `RAILWAY_ENVIRONMENT` is set, else the socket
  peer (`rate_limit.client_ip`). Eventtz keeps its existing allowances.

## Consequences
- Local development and tests need no Redis.
- Limits are shared across replicas when Redis is on.
