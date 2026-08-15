# Backend naming standard

Canonical vocabulary for Eventtz backend Python and API JSON. Postgres column names are unchanged; map at the DB boundary.

## Glossary

| Concept | Use | Avoid |
|---------|-----|-------|
| Booking enquiry row | `booking_request`, `booking_request_id` | `booking_id` for `booking_requests.id` |
| Vendor onboarding JSON | `profile_form_data` (API + Python) | `payload` at API boundaries |
| Supabase client | `get_db()` | `get_client()` |
| User IDs in handlers | `vendor_user_id`, `client_user_id`, `participant_user_id` | bare `uid` |
| List HTTP handlers | `list_*` | `get_list_*` |
| Query results | `query_result`, `*_rows`, `*_row` | bare `res`, `data`, `row` in multi-step functions |
| Copilot context | `vendor_context` | bare `ctx` in vendor_copilot |
| Vendor draft workflow | `onboarding_status` | bare `status` next to `approval_status` |
| Booking lifecycle | `booking_status` | bare `status` on booking models |
| Dispute on booking models | `booking_lifecycle_status` | `booking_status` next to dispute `status` |
| Copilot action payload | `action_data.booking_request_id` | `booking_id` inside action_data |
| Price adjustment type | `adjustment_category` | `tag` on adjustment items |
| Copilot actions | `action_type` | `kind` on CopilotAction |
| Audit log metadata | `audit_event_details` | `payload` on admin audit |
| Chat message role | `message_role` | bare `role` on ask/history messages |
| DB query helpers | `first_row_from_query_result`, `rows_from_query_result` | `one_row`, `rows` |

## Module rules

- `app/contracts/` holds all HTTP request/response Pydantic models; do not define API contracts inline in `features/*/http/`.
- **`build_app_user`** in `features/auth/accounts.py` is the single builder for merged auth + app profile (`AuthUser`).
- User-facing API copy lives in feature **`messages.py`** or **`copy.py`** (e.g. `auth/messages.py`, `notifications/copy.py`), not inline in HTTP handlers.
- `db*.py` fetchers: `{entity}_by_id` (e.g. `get_booking_request_by_id`), not `get_by_id`.
- No `_http` suffix inside `http/` packages.
- Prefer `{domain}_{purpose}.py` over `*_helpers.py`, `lookup.py`, `retrieve.py`.

## PR checklist

- [x] A. Core infrastructure (PR 1)
- [x] B. Contracts / API JSON
- [x] C. Bookings domain
- [x] D. Vendors domain
- [x] E. Auth + settings
- [x] F. Chat + notifications
- [x] G. Admin platform
- [x] H. Planner + help + vendor_copilot
- [x] I. Payments + referrals + remaining
- [x] J. Tests + final grep sweep

Update checkboxes as each phase merges.
