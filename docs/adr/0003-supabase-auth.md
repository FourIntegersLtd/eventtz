# 0003 — Keep Supabase Auth

Status: accepted (2026-09-25)

## Decision
Supabase Auth stays the identity provider, with the existing `eventtz_*` HTTP-only
cookies. `core/auth.py` turns the session into a `Principal`; routers declare one
dependency (`CurrentUser`, `CurrentClient`, `CurrentVendor`, `CurrentStaff`) instead
of calling guards by hand. What a user may do comes from the server
(`GET /api/v1/me/capabilities`), not from hardcoded lists in the frontend.
