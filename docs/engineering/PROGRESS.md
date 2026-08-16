# Eventtz Engineering Course — Progress

Personal engineering course using the real Eventtz codebase.

**Course branch:** `cursor/engineering-course-28c8`  
**Primary track:** [FEATURE_TRACK.md](./FEATURE_TRACK.md)  
**Curriculum:** [CURRICULUM.md](./CURRICULUM.md)

### Learner preferences

- **Models over SQL** — teach via `contracts/`, `domain-types.ts`, and feature code; SQL only on migration days or when asked.
- **Complete route** — every example lists the full file path chain (UI → API → contract → feature → `get_db()`) before showing code snippets.
- **Descriptive names** — immediately understandable; see [NAMING.md](./NAMING.md).
- **Skip mandatory tasks** — teacher-led feature walkthroughs; no hunts/exit tickets unless requested.
- **Primary track:** [FEATURE_TRACK.md](./FEATURE_TRACK.md) (auth → booking → payment → payout).

---

## Feature track progress

| Slice | Status |
|-------|--------|
| 1 Authentication | **complete** |
| 2 Client browse | **complete** |
| 3a Client booking — enquire | **complete** |
| 3b Client booking — rest | not started |
| 4 Client payment | not started |
| 5 Vendor quote + accept | not started |
| 6 Vendor payout | not started |

---

## Slice 1 — Authentication (feature track)

**Date completed:** 2026-08-16  
**Code base:** merged `main` through app-folder restructure (`(auth)/`, `(marketing)/`, `(portal)/`), `backend/app/contracts/auth.py`, Supabase-only auth (no local store).

### Covered

| Area | Topics |
|------|--------|
| Session | Cookie tokens (`eventtz_access_token` / `eventtz_refresh_token`), `GET /me`, refresh interceptor on 401 |
| Sign-in | `UnifiedLoginView` → `POST /signin` → `build_app_user` → `resolvePostAuthPath` |
| Role / UI | `user_type` from `/me`; layouts under `client/(portal)/`, `vendor/(portal)/`, `admin/(portal)/`; `PortalShell portal=` for nav |
| Guards | `RequireAuth` / `RequireRole` (frontend); `require_user`, `require_client`, etc. (backend) |
| Sign-up | `POST /signup`, `session: null`, `user_type` + optional `referral_code` (vendor) |
| Email verify | `issue_email_verification` → `/verify-email?token=` → `email_verified_at`; sign-in blocked until verified |
| Referral | `?ref=` / cookie → `referralSlug` → `referral_code` on vendor signup → `referral_attributions` |
| Sign-out | `POST /signout`, `clear_session_cookies`, `AuthProvider` clears `user` |
| Passwords | Forgot (enumeration-safe) → reset link → `POST /reset-password` signs in; change-password revokes sessions |
| Admin auth | Unified `/login` (`/admin/login` redirects via `next.config.ts`); `?next=/admin/dashboard` |

### Key files (bookmark)

- `frontend/app/README.md` — URL → folder map
- `frontend/app/(auth)/` — login, register, verify-email, forgot/reset password
- `frontend/components/auth/AuthProvider.tsx`
- `frontend/lib/auth-api.ts`, `frontend/features/auth/authRouting.ts`
- `backend/app/contracts/auth.py`
- `backend/app/features/auth/http/routes.py`, `guards.py`, `session.py`, `accounts.py`
- `backend/app/features/auth/email_verification.py`, `password_reset.py`, `messages.py`

### Lesson status

**Complete** — see `lessons/slice-1-auth-me.md`.

---

## Slice 2 — Client browse (feature track)

**Date completed:** 2026-08-16  
**Lesson:** `docs/engineering/lessons/slice-2-client-browse.md`

### Covered

| Area | Topics |
|------|--------|
| URLs | `/client/browse`, `/client/browse/[userId]`, `/explore` → browse redirect |
| Layout | `ClientBrowsePortalLayout` — guests public chrome; clients `PortalShell` |
| List UI | `MarketplaceExploreView`, URL search params, `fetchExploreVendorsSearch` |
| Detail UI | `ClientVendorBrowseDetailView`, `useExploreVendor`, `VendorBrowseDetailBody` |
| API | Public `GET /vendors/explore/search`, `GET /vendors/explore/vendor/{id}` (no auth guards) |
| Listing rules | `apply_public_listing_filters` — approved + Stripe ready or admin `visible`, not `hidden` |
| Models | `ExploreVendorRow`, `ExploreVendorSearchRow` in contracts + `clientExploreApi.ts` |
| Metrics | Review stats + `public_metrics` merged on explore responses |
| Query parse | `search_ai.py` — LLM-only `parse_marketplace_query`; token-only keywords fallback when OpenAI down |

### Key files (bookmark)

- `frontend/app/client/(portal)/browse/`
- `frontend/features/marketplace/MarketplaceExploreView.tsx`
- `frontend/features/client/browse/`
- `frontend/lib/clientExploreApi.ts`, `frontend/lib/marketplaceSearchParams.ts`
- `backend/app/features/vendors/http/explore.py`
- `backend/app/features/vendors/moderation.py`, `visibility.py`, `search.py`, `search_ai.py`
- `backend/app/contracts/vendor.py`

### Lesson status

**Complete** — ready for Slice 3a (Client booking — enquire).

---

## Slice 3a — Client booking: enquire (feature track)

**Date completed:** 2026-08-16  
**Lesson:** `docs/engineering/lessons/slice-3a-client-booking-enquire.md`

### Covered

| Area | Topics |
|------|--------|
| Entry UI | `VendorBookingModal` (single vendor), `MultiVendorEnquireModal` (browse multi-select) |
| Auth | Client-only enquire; `require_client` on POST; guests see login |
| API | `POST /api/v1/client/booking-requests` |
| Snapshot | `resolve_line_items` — prices from vendor profile at submit, stored in `line_items` JSON |
| Payload | Client sends `selected_option_ids` only — no prices from browser |
| Create flow | `create_booking_request` — calendar, pricing, insert, chat notes, notifications |
| Status | `pending`, `initiator: client`, payment `unpaid` |
| After submit | Toast + redirect `/client/bookings/{id}` |

### Key files (bookmark)

- `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx`
- `frontend/features/client/browse/VendorBookingModal.tsx`
- `frontend/features/marketplace/MultiVendorEnquireModal.tsx`
- `frontend/lib/clientBookingsApi.ts`, `frontend/lib/validation/bookings.ts`
- `backend/app/features/bookings/http/client.py`
- `backend/app/features/bookings/create.py`
- `backend/app/features/vendors/list_pricing.py` — `resolve_line_items`
- `backend/app/contracts/booking.py` — `CreateBookingRequestBody`

### Lesson status

**Complete** — ready for Slice 3b (booking detail, status, adjustments).

---

## Legacy — concept days (on hold)

### Day 1 — What is system architecture?

**Date started:** 2026-08-14

### Concept

System architecture is deciding **who does what** and **how the parts communicate**.  
Like a restaurant: customer, waiter, kitchen, cashier, and delivery each have a role.

**One-sentence definition:** System architecture is the blueprint for how the pieces of software fit together and pass work between each other.

### What I understood

_(To be filled in after you explain the concept back in your own words.)_

### What I struggled with

_(To be filled in during/after the lesson.)_

### Important Eventtz code

| Area | Location | Role |
|------|----------|------|
| Frontend (UI) | `frontend/` | Next.js app — pages users see |
| API client layer | `frontend/lib/*Api.ts` | Frontend talks to backend through these |
| Backend entry | `backend/app/main.py` | FastAPI app starts here |
| Route registry | `backend/app/http/router.py` | Lists all API feature routers |
| Booking creation | `backend/app/features/bookings/create.py` | Business logic for new enquiries |
| Booking API | `backend/app/features/bookings/http/client.py` | HTTP endpoints clients call |
| Database schema | `backend/sql/` | SQL migrations (Postgres via Supabase) |
| Auth | `backend/app/features/auth/` | Login, sessions, cookies |
| Payments | `backend/app/features/bookings/payments.py`, `backend/app/features/payments/` | Stripe Connect + Checkout |
| File storage | `backend/app/features/media/` + Supabase Storage | Images/uploads |
| Tests | `backend/tests/`, `frontend/**/*.test.ts` | Automated checks |
| Deploy | `backend/railway.toml`, Railway CLI | Backend hosting |

### Decisions made

- **Leave it alone:** Eventtz's split (Next.js frontend + FastAPI backend + Supabase + Stripe) is a sensible, simple architecture for a marketplace at current scale. No need for microservices yet.
- **Improve later:** As traffic grows, we may add caching, background job queues, or read replicas — but only when a real bottleneck appears.

### Improvements made

- Created `docs/engineering/PROGRESS.md` and `docs/engineering/GLOSSARY.md` to track the course.

### Lesson status

**In progress** — waiting for learner to answer quiz questions and explain the concept back.

---

## Day 2 — How to model a real-world problem? (v2 redo)

**Date started:** 2026-08-14  
**Curriculum:** v2 — concept + code trace + hands-on rep required

### Concept

Before you write routes or SQL, name the **nouns** (entities), how they connect (relationships), which feature owns each noun (domain boundaries), and what must be **snapshotted** vs read **live**.

**One-sentence definition:** Domain modeling is naming what exists, how it relates, and what must not change when the source data changes later.

### What I understood

Domain modeling: entities, relationships, domain boundaries, snapshot (`line_items`) vs live (FK to `users`). £200 package stays on booking when vendor edits catalog to £300. Code trace: UI → `clientBookingsApi` → `client.py` → `create.py` → `list_pricing` → `booking_requests`.

### What I struggled with

_(Optional — fill in later.)_

### Code trace (Day 2 v2)

1. [x] `frontend/lib/clientBookingsApi.ts`
2. [x] `backend/app/features/bookings/http/client.py`
3. [x] `backend/app/features/bookings/create.py`
4. [x] `backend/app/features/vendors/list_pricing.py`
5. [x] `backend/sql/010_booking_requests.sql`

### Hands-on rep (Day 2 v2)

- [x] Code trace delivered in lesson (exit ticket skipped per learner request)

### Lesson status

**Complete** — 2026-08-14 (v2 redo; explain-back skipped on request).

---

## Day 3 — How databases actually work?

**Date started:** 2026-08-14  
**Curriculum:** v2

### Concept

A database stores **tables** of **rows** and **columns** with strict **types**. Each row has a **primary key** (unique id). **Foreign keys** link tables and define what happens on delete (`CASCADE`, `SET NULL`, `RESTRICT`). Eventtz schema lives in `backend/sql/`; the backend talks to Postgres through Supabase via `get_db()`.

**One-sentence definition:** A database is typed, permanent storage where tables relate to each other through keys and rules enforced by Postgres.

### What I understood

_(Lesson delivered — fill in when ready.)_

### Important Eventtz code

| Area | Location | Role |
|------|----------|------|
| Schema migrations | `backend/sql/001_*.sql`, `010_*.sql`, … | Source of truth for tables |
| DB client | `backend/app/core/db.py` | `get_db()` → Supabase service client |
| Insert example | `backend/app/features/bookings/create.py` | `.table("booking_requests").insert(...)` |
| FK + CASCADE | `backend/sql/010_booking_requests.sql` | `client_user_id` / `vendor_user_id` → `users` |
| Delete bug fix | `backend/sql/063_fix_user_delete_fk_constraints.sql` | CASCADE vs SET NULL vs RESTRICT |
| Row helpers | `backend/app/core/db.py` | `rows()`, `one_row()` parse query results |

### Code trace (Day 3)

`create.py` insert → `get_db()` → Supabase PostgREST → Postgres `booking_requests` table (columns + FK constraints)

### Break-it answer

Delete `auth.users` row → cascades to `public.users` → cascades to `booking_requests` where that user is client or vendor (and related rows in reviews, chat, etc.). `ON DELETE SET NULL` keeps the row but clears the FK; `RESTRICT` blocks the delete.

### Decisions made

- **Leave it alone:** Numbered SQL migrations in `backend/sql/`
- **Leave it alone:** Service-role Supabase client in backend only
- **Improve later:** Soft-delete users instead of hard delete for audit (product decision)

### Lesson status

**Complete** — 2026-08-14 (lesson delivered; explain-back optional).
