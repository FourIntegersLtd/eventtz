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

---

## Day 3

**Table** — A named collection of rows in the database (e.g. `booking_requests`, `users`).

**Row** — One record in a table (e.g. a single booking enquiry).

**Column** — One field on every row (e.g. `event_date`, `line_items`).

**Primary key (PK)** — The column(s) that uniquely identify a row (Eventtz: usually `id uuid`).

**Foreign key (FK)** — A column that points at another table's primary key (e.g. `client_user_id` → `users.id`).

**Postgres / PostgreSQL** — The relational database Eventtz uses, hosted via Supabase.

**Migration** — A numbered SQL file in `backend/sql/` that creates or changes tables (the schema history).

**Supabase client** — Python client in `get_db()` that sends queries to Postgres over HTTP (PostgREST).

**ON DELETE CASCADE** — When parent row is deleted, child rows are deleted too (e.g. delete user → delete their bookings).

**ON DELETE SET NULL** — When parent is deleted, FK column becomes `NULL` (row survives, link broken).

**ON DELETE RESTRICT** — Blocks deleting the parent if children still exist (default if not specified).

**JSONB** _(reinforced)_ — Postgres column type for JSON; still a column with a type, just flexible inside.

---

## Slice 1 — Authentication

**Session cookie** — HttpOnly cookie holding the access or refresh token; browser sends it automatically (`withCredentials`); not the same as `user_type`.

**build_app_user** — Backend helper that merges Supabase auth user + `public.users` (+ client onboarding) into the `AuthUser` contract for `/me` and sign-in responses.

**Email verification gate** — Client/vendor accounts must have `email_verified_at` set before `POST /signin` succeeds; admins exempt.

**Enumeration-safe message** — API returns the same text whether or not an email exists (forgot password, resend verification) so attackers cannot probe registered emails.

**Route group** — Next.js folder like `(auth)/` or `(portal)/` that organizes files without adding a URL segment.

**referral_code** — Partner slug sent on vendor `POST /signup`; recorded in `referral_attributions` when valid.

---

## Slice 2 — Client browse

**Explore / browse** — Marketplace discovery: search approved vendors and open read-only profiles (`/client/browse`).

**Public listing gate** — Rule in `visibility.py`: vendor must be `approval_status = approved`, not `listing_override = hidden`, and either Stripe Connect ready or admin `listing_override = visible`.

**profile_form_data** — Vendor marketing profile JSON from `vendors.payload`; returned on explore APIs as the shape clients render (business name, gallery, services, packages).

**explore/search vs explore** — Search endpoint supports filters, sort, pagination, and plan mode; plain `/explore` returns a country-scoped approved list (browse UI uses search).

**Embedded browse** — `MarketplaceExploreView embedded={true}` when a signed-in client browses inside the portal (less marketing chrome).

**Search context on URL** — Filters encoded in query params (`marketplaceSearchParams.ts`) so list ↔ detail navigation preserves filters.

**match_tier** — Search quality label on a row: `exact`, `related`, or `fallback` (close-enough matching).

**parse_marketplace_query** — `search_ai.py` entry: turns free-text `q` into keywords, location, types, and optional plan `needs`. LLM-only for structure; `_token_only_parse` is keywords-only when OpenAI is unavailable.

**token_only parse** — Degraded parse path: split `q` into keyword tokens, `mode=simple`, no types or plan needs. Does not synonym-map or build canned checklists.
