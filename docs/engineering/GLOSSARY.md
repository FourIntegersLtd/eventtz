# Eventtz Engineering Glossary

Simple definitions for terms we learn in the 30-day course.  
Format: **term** — plain-English meaning.

---

## Day 1

**System architecture** — The plan for which parts of the software exist, what each part is responsible for, and how they talk to each other.

**Frontend** — The part of the app the user sees and clicks in their browser (Eventtz: Next.js in `frontend/`).

**Backend** — The part that runs on a server, enforces rules, and talks to the database and external services (Eventtz: FastAPI in `backend/`).

**API (Application Programming Interface)** — A set of URLs the frontend (or other systems) can call to ask the backend to do something, like "create a booking."

**Database** — Long-term storage for data (Eventtz: PostgreSQL hosted by Supabase).

**External service** — Another company's software that Eventtz uses but does not own (e.g. Stripe for payments, Supabase for database/auth).

**Separation of concerns** — Giving each part of the system one clear job instead of mixing everything together.

**Client-server model** — The browser (client) asks; the server decides and responds. The browser should not be trusted to enforce security rules alone.

**Monolith** — One main backend application that handles many features (Eventtz today is a monolith — one FastAPI app with many feature folders).

**Deployment** — Putting the running software onto servers so real users can reach it (Eventtz: backend on Railway, frontend on a Next.js host).

---

## Day 2

**Entity** — A thing in the system with its own identity that persists over time (e.g. a user, a vendor account, a booking request).

**Relationship** — How two entities connect (e.g. a booking *belongs to* a client user and a vendor user via foreign keys).

**Domain boundary** — A line around one area of the product; one feature or team owns the data and rules inside it (e.g. vendor profile vs booking commerce).

**Snapshot data** — A copy of fields saved at a point in time so later edits at the source do not rewrite history (Eventtz: `booking_requests.line_items`).

**Live data** — Values read from the current authoritative source when needed (Eventtz: vendor display name fetched when rendering a list).

**Contract** — A typed description of data crossing an API boundary (Eventtz: Pydantic models in `backend/app/contracts/`).

**Domain types** — Shared TypeScript types so client and vendor UIs use the same vocabulary (Eventtz: `frontend/lib/domain-types.ts`).

**JSONB** — A Postgres column type for structured JSON; Eventtz uses it for flexible blobs like `line_items` and `vendors.payload`.

**Catalog domain** — Vendor listing and profile data (packages, rates in `vendors.payload`) — vendors can edit this freely.

**Commerce domain** — Booking lifecycle (`booking_requests`, payments, adjustments) — must preserve what was agreed at enquiry time.
