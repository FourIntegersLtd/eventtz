# Eventtz Engineering Course — 30-Day Curriculum

**For:** Self-taught developer (doctor background) learning production-grade engineering through the real Eventtz codebase.

**Teaching style:** Plain English first → technical term → Eventtz example. One major idea per day.

**How to use this course**

1. **This document** is your map. Stay here to see the full four weeks.
2. **Each day** has a spin-off prompt in `docs/engineering/lessons/day-XX.md`.
3. Open a **new Cursor chat**, paste that day's prompt, and complete the lesson there.
4. Return here to pick the next day. Track progress in `docs/engineering/PROGRESS.md`.

---

## Course outcomes (end of Week 4)

You should be able to look at Eventtz (or any new app) and answer:

| Question | You'll know how to… |
|----------|---------------------|
| What are the main parts? | Draw a client → API → database → external services diagram |
| What does each part do? | Name responsibilities and where code lives |
| Where does data live? | Identify tables, files, caches, and who writes to them |
| Who is allowed to change it? | Trace auth + authorisation through API guards |
| What if two people act at once? | Spot race conditions; know transactions and locks |
| What if something fails? | Design retries, idempotency, graceful degradation |
| What if the same request happens twice? | Apply idempotency keys and deduplication |
| What at 100× scale? | Identify the first bottleneck; avoid premature complexity |
| How would I know something broke? | Use logs, metrics, alerts |
| How would I recover? | Backups, migrations, disaster recovery |
| Is this over-engineered? | Choose the simplest architecture that fits the problem |

---

## Week 1 — How software systems work

*Goal: Understand the shape of Eventtz and how data flows through it.*

| Day | Topic | You'll learn | Key Eventtz areas |
|-----|-------|--------------|-------------------|
| **1** | What is system architecture? | Layers, separation of concerns, client-server | `frontend/`, `backend/app/`, `router.py`, booking flow |
| **2** | How to model a real-world problem | Entities, relationships, domain boundaries | `users`, `vendors`, `booking_requests`, contracts |
| **3** | How databases actually work | Tables, rows, types, migrations, Postgres | `backend/sql/`, Supabase, `db.py` |
| **4** | How databases find data quickly | Indexes, query plans, when indexes hurt | `idx_*` in SQL, explore search, listing indexes |
| **5** | How to make database changes safely | Migrations, rollbacks, zero-downtime thinking | `backend/sql/0xx_*.sql`, migration ordering |
| **6** | Two people doing something at once | Concurrency, race conditions, transactions | Booking capacity, `calendar.py`, daily limits |
| **7** | How APIs work | REST, request/response, versioning, errors | `/api/v1`, contracts, `http/router.py` |

---

## Week 2 — Making software safe and correct

*Goal: Trust, permissions, and talking to the outside world.*

| Day | Topic | You'll learn | Key Eventtz areas |
|-----|-------|--------------|-------------------|
| **8** | Login: authentication | Sessions, cookies, JWT, password reset | `auth/`, `AuthProvider`, session cookies |
| **9** | Permissions: authorisation | Roles, guards, least privilege | `require_client`, `require_vendor`, admin roles |
| **10** | Security basics | OWASP mindset, secrets, input validation, CORS | `.env`, service role key, CORS, validation |
| **11** | Same request twice | Idempotency, duplicate submits, safe retries | Stripe webhooks, checkout sync, payment finalize |
| **12** | Talking to services we don't control | SDKs, timeouts, retries, circuit breakers | Stripe API, Supabase, OpenAI, GetAddress |
| **13** | Webhooks and events | Push vs pull, signatures, ordering | `webhooks/stripe`, webhook secrets |
| **14** | Background jobs and queues | Async work, cron, maintenance jobs | `jobs/run_booking_maintenance.py`, email dispatch |

---

## Week 3 — Making software production-ready

*Goal: Operate Eventtz reliably in the real world.*

| Day | Topic | You'll learn | Key Eventtz areas |
|-----|-------|--------------|-------------------|
| **15** | Caching | What to cache, TTL, invalidation, when not to cache | Explore index, static assets, future Redis |
| **16** | Storing files and images | Object storage, URLs, access control | Supabase Storage, `media/`, bucket SQL |
| **17** | Search | Full-text, filters, ranking | `vendors/search.py`, ranking engine, explore |
| **18** | Logging and monitoring | Structured logs, levels, Mixpanel, health checks | `core/logging`, `/health`, analytics |
| **19** | Handling things going wrong | Errors, partial failure, user-facing messages | `core/errors`, disputes, payment failures |
| **20** | Testing | Unit vs integration, what to test, pytest/vitest | `backend/tests/`, `*.test.ts` |
| **21** | Deploying software safely | CI, env vars, Railway, rollbacks | `railway.toml`, Procfile, deploy checklist |

---

## Week 4 — Making software bigger and stronger

*Goal: Think like a senior engineer about scale, cost, and redesign.*

| Day | Topic | You'll learn | Key Eventtz areas |
|-----|-------|--------------|-------------------|
| **22** | Servers and cloud infrastructure | VMs, containers, managed services | Railway, Supabase, Next.js hosting |
| **23** | Scaling | Vertical vs horizontal, stateless APIs, DB limits | API design, connection pools, bottlenecks |
| **24** | Reliability | SLAs, redundancy, graceful degradation | Health checks, webhook fallback, sync |
| **25** | Distributed systems | CAP, eventual consistency, split brain | Multi-service flows: pay → webhook → DB |
| **26** | Keeping large codebases organised | Features, layers, conventions | `features/`, `lib/`, `cursor.md` patterns |
| **27** | Making software faster | Profiling, N+1 queries, frontend perf | Hot paths: explore, bookings list |
| **28** | Keeping cloud costs under control | What costs money, when to optimise | Supabase, Stripe fees, Railway, OpenAI |
| **29** | Backups, migrations, disaster recovery | RPO/RTO, restore drills, data safety | SQL migrations, Supabase backups |
| **30** | Redesign Eventtz like a senior engineer | Architecture review, trade-offs, roadmap | Full-system critique + evolution path |

---

## Daily lesson structure (every spin-off)

Each lesson follows this format:

1. Today's idea (plain English + one-sentence definition)
2. Why should I care? (analogy + Eventtz)
3. Find it in Eventtz (search repo, show real files)
4. Walk through one example step by step
5. Teach the technical term
6. Break it (realistic problem — you guess first)
7. Teach through questions (one at a time, hints not answers)
8. Show the solution (Eventtz code + what could still go wrong)
9. Compare alternatives (simplest first, when to upgrade)
10. Improve Eventtz (Fix now / Improve later / Leave it alone)
11. Check understanding (explain back in your own words)
12. Update `PROGRESS.md` and `GLOSSARY.md`

---

## Spin-off prompts

Copy the prompt from the matching file and paste into a **new chat**:

| Day | File |
|-----|------|
| 1 | [lessons/day-01.md](./lessons/day-01.md) |
| 2 | [lessons/day-02.md](./lessons/day-02.md) |
| 3 | [lessons/day-03.md](./lessons/day-03.md) |
| 4 | [lessons/day-04.md](./lessons/day-04.md) |
| 5 | [lessons/day-05.md](./lessons/day-05.md) |
| 6 | [lessons/day-06.md](./lessons/day-06.md) |
| 7 | [lessons/day-07.md](./lessons/day-07.md) |
| 8 | [lessons/day-08.md](./lessons/day-08.md) |
| 9 | [lessons/day-09.md](./lessons/day-09.md) |
| 10 | [lessons/day-10.md](./lessons/day-10.md) |
| 11 | [lessons/day-11.md](./lessons/day-11.md) |
| 12 | [lessons/day-12.md](./lessons/day-12.md) |
| 13 | [lessons/day-13.md](./lessons/day-13.md) |
| 14 | [lessons/day-14.md](./lessons/day-14.md) |
| 15 | [lessons/day-15.md](./lessons/day-15.md) |
| 16 | [lessons/day-16.md](./lessons/day-16.md) |
| 17 | [lessons/day-17.md](./lessons/day-17.md) |
| 18 | [lessons/day-18.md](./lessons/day-18.md) |
| 19 | [lessons/day-19.md](./lessons/day-19.md) |
| 20 | [lessons/day-20.md](./lessons/day-20.md) |
| 21 | [lessons/day-21.md](./lessons/day-21.md) |
| 22 | [lessons/day-22.md](./lessons/day-22.md) |
| 23 | [lessons/day-23.md](./lessons/day-23.md) |
| 24 | [lessons/day-24.md](./lessons/day-24.md) |
| 25 | [lessons/day-25.md](./lessons/day-25.md) |
| 26 | [lessons/day-26.md](./lessons/day-26.md) |
| 27 | [lessons/day-27.md](./lessons/day-27.md) |
| 28 | [lessons/day-28.md](./lessons/day-28.md) |
| 29 | [lessons/day-29.md](./lessons/day-29.md) |
| 30 | [lessons/day-30.md](./lessons/day-30.md) |

---

## Prerequisites assumed

- You can read TypeScript and Python at a basic level
- You have run Eventtz locally (frontend + backend) or are willing to explore the repo read-only
- You complete each day's "explain back" before moving on

---

## Files maintained during the course

| File | Purpose |
|------|---------|
| `docs/engineering/CURRICULUM.md` | This file — full 30-day map |
| `docs/engineering/lessons/day-XX.md` | Spin-off prompt per day |
| `docs/engineering/PROGRESS.md` | Your notes per day |
| `docs/engineering/GLOSSARY.md` | Terms in plain English |
