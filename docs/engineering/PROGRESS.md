# Eventtz Engineering Course — Progress

Personal 30-day software engineering course using the real Eventtz codebase.

**Course branch:** `cursor/engineering-course-28c8` (all days — do not split per lesson)

**Curriculum map:** [CURRICULUM.md](./CURRICULUM.md)  
**Lesson spin-offs:** [lessons/](./lessons/)

---

## Day 1 — What is system architecture?

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

## Day 2 — How to model a real-world problem?

**Date started:** 2026-08-14

### Concept

Before you write routes or SQL, name the **nouns** in the problem (entities), how they connect (relationships), and which feature owns each noun (domain boundaries). Then decide: should this field stay **live** (read from source) or be a **snapshot** (frozen at a moment in time)?

**One-sentence definition:** Domain modeling is naming what exists, how it relates, and what must not change when the source data changes later.

### What I understood

_(To be filled in after you explain the concept back in your own words.)_

### What I struggled with

_(To be filled in during/after the lesson.)_

### Important Eventtz code

| Area | Location | Role |
|------|----------|------|
| Users + vendors schema | `backend/sql/001_users_and_vendor_onboarding.sql` | Core entities; vendor profile in `vendors.payload` JSONB |
| Booking schema | `backend/sql/010_booking_requests.sql` | Commerce entity; `line_items` JSONB snapshot |
| Line item contract | `backend/app/contracts/booking.py` | `BookingLineItemIn` — API shape for a package row |
| Resolve catalog → snapshot | `backend/app/features/vendors/list_pricing.py` | `resolve_line_items()` reads live vendor payload |
| Persist snapshot | `backend/app/features/bookings/create.py` | Copies resolved `line_items` onto the booking row |
| Shared UI vocabulary | `frontend/lib/domain-types.ts` | Booking status, pricing breakdown types |

### Decisions made

- **Leave it alone:** `booking_requests.line_items` as JSONB snapshot — correct for deal integrity when vendors edit packages.
- **Leave it alone:** FKs to `users` for client/vendor — live identity; display names can be re-fetched.
- **Improve later:** If disputes need audit trails, consider immutable adjustment history (already partially modeled via `vendor_adjustments`).

### Improvements made

- Day 2 lesson delivered on `cursor/engineering-course-28c8` (renamed from `cursor/day1-system-architecture-db2a`).
- Added Day 2 terms to `GLOSSARY.md`.

### Lesson status

**In progress** — break-it understood (Steps 6–10 delivered). Waiting for Step 11 explain-back to mark complete.
