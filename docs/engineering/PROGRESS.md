# Eventtz Engineering Course — Progress

Personal 30-day software engineering course using the real Eventtz codebase.

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
