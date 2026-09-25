# 0005 — Server-sent events stay in memory on a single replica

Status: accepted (2026-09-25)

## Decision
Realtime (chat, notifications) uses the in-process SSE hub in `core/sse.py`. The API
runs as **one** Railway replica. Scaling out requires a shared bus (Postgres
LISTEN/NOTIFY or Redis) first — record that as a new ADR.
