# Eventtz Engineering Glossary

Terms introduced in the curriculum. New days append here — do not redefine in lessons without updating this file.

---

## Day 1 terms

| Term | Definition |
|------|------------|
| **Route** | HTTP entry point that maps a URL + method to a handler (see `backend/app/http/router.py`). |
| **Feature module** | A folder under `backend/app/features/` that owns one product area's behavior. |
| **Contract** | A Pydantic model in `backend/app/contracts/` describing request/response shapes shared with the frontend. |
| **Migration** | A versioned SQL file under `backend/sql/` that defines or alters database schema. |

---

## Day 2 terms

| Term | Definition |
|------|------------|
| **Entity** | A distinct thing with persistent identity in the domain (e.g. `users`, `vendors`, `booking_requests`). |
| **Relationship** | How entities connect — often a foreign key (`client_user_id`) or a lifecycle link (booking belongs to client and vendor). |
| **Domain boundary** | The line around one product area whose module owns the data and rules (vendor profile vs booking commerce). |
| **Snapshot data** | Fields copied into a record at a point in time so later changes at the source do not rewrite history (e.g. `booking_requests.line_items`). |
| **Live data** | Values read from the current authoritative source when needed (e.g. vendor display name from profile at list-render time). |
| **Domain types** | Shared TypeScript types in `frontend/lib/domain-types.ts` for cross-portal vocabulary (booking status, pricing breakdown). |
| **JSONB** | Postgres column type for structured JSON; Eventtz uses it for flexible snapshots (`line_items`, `vendors.payload`). |
| **Resolve** | At booking creation, map `selected_option_ids` against live `vendors.payload` to build priced `line_items` once (`resolve_line_items`). |
| **Catalog domain** | Vendor listing/profile data (`vendors.payload`, packages, rates) — mutable by the vendor. |
| **Commerce domain** | Booking lifecycle (`booking_requests`, payments, adjustments) — must preserve deal terms. |
