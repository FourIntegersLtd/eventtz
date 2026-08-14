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

## Day 2 — How to model a real-world problem? (v2 redo)

**Date started:** 2026-08-14  
**Curriculum:** v2 — concept + code trace + hands-on rep required

### Concept

Before you write routes or SQL, name the **nouns** (entities), how they connect (relationships), which feature owns each noun (domain boundaries), and what must be **snapshotted** vs read **live**.

**One-sentence definition:** Domain modeling is naming what exists, how it relates, and what must not change when the source data changes later.

### What I understood

_(To be filled in after v2 redo — Step 11 explain-back.)_

### What I struggled with

_(To be filled in during/after the lesson.)_

### Important Eventtz code

| Area | Location | Role |
|------|----------|------|
| Users + vendors schema | `backend/sql/001_users_and_vendor_onboarding.sql` | Core entities; vendor profile in `vendors.payload` JSONB |
| Booking schema | `backend/sql/010_booking_requests.sql` | Commerce entity; `line_items` JSONB snapshot |
| Line item contract | `backend/app/contracts/booking.py` | `BookingLineItemIn` — API shape for a package row |
| Frontend API call | `frontend/lib/clientBookingsApi.ts` | `postBookingRequest` — sends IDs only, not prices |
| HTTP handler | `backend/app/features/bookings/http/client.py` | `post_booking_request` route |
| Resolve catalog → snapshot | `backend/app/features/vendors/list_pricing.py` | `resolve_line_items()` reads live vendor payload |
| Persist snapshot | `backend/app/features/bookings/create.py` | Copies `line_items` onto the booking row |
| Detail read | `backend/app/features/bookings/queries.py` | Reads stored `line_items`, does not re-join vendor |
| Shared UI vocabulary | `frontend/lib/domain-types.ts` | `BookingLineItem`, status types |
| Bug-fix compass | `docs/engineering/CODEBASE_MAP.md` | Full path chains |

### Code trace (Day 2 v2) — complete this with teacher

File chain for **client booking enquiry**:

1. [ ] `frontend/lib/clientBookingsApi.ts` — `postBookingRequest` (payload has `selected_option_ids`, no price)
2. [ ] `backend/app/features/bookings/http/client.py` — `post_booking_request`
3. [ ] `backend/app/features/bookings/create.py` — `create_booking_request` → writes `line_items`
4. [ ] `backend/app/features/vendors/list_pricing.py` — `resolve_line_items`
5. [ ] `backend/sql/010_booking_requests.sql` — `line_items jsonb` column + comment

### Hands-on rep (Day 2 v2)

- [ ] Open each file above and confirm what step it does
- [ ] In `CreateBookingRequestBody` / `clientBookingsApi.ts`: confirm browser cannot send `unit_price_gbp`
- [ ] Answer: vendor changes package to £300 tonight — which DB column still shows £200?
- [ ] `rg "resolve_line_items" backend/` — how many call sites? (create only, not read)

### Decisions made

- **Leave it alone:** `line_items` JSONB snapshot at create time
- **Leave it alone:** FKs to `users` for live identity
- **Improve later:** normalized `booking_line_items` table only if reporting needs it

### Improvements made

- Day 2 v1 (concepts only) superseded by v2 redo
- Curriculum v2 + `CODEBASE_MAP.md` added

### Lesson status

**In progress (v2 redo)** — code trace + hands-on rep + Step 11 explain-back pending.
