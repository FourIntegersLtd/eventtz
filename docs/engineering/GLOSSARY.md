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
