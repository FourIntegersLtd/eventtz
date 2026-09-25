# 0001 — Backend feature slices with a fixed anatomy

Status: accepted (2026-09-25)

## Context
24 backend feature folders each had a different shape. Supabase calls were spread
across ~87 files, and bookings/payments/vendors/email/chat imported each other both ways.

## Decision
Each product area is one slice in `api/app/features/<slice>/` with the same files:
`README.md`, `domain.py` (pure), `models.py` (rows), `repository.py` (only DB access),
`service.py` (use cases, raises `AppError`), `schemas.py` (API shapes), `errors.py`,
`router.py` (thin), optional `jobs.py` and `router_admin.py` / `router_vendor.py`.
A slice may import another slice's `service` only. `core` never imports a feature.
AST guards in `api/tests/guards/` enforce this, each with a meta-test.

## Consequences
Structure is checked by CI, so agents can change code without eroding it. More files
per area; the laziness protocol still applies (skip `domain.py` when there are no rules).
