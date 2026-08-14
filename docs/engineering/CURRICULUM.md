# Eventtz Engineering Course — 30-Day Curriculum

**For:** Self-taught developer (doctor background) learning production-grade engineering through the real Eventtz codebase.

**Teaching style:** Plain English first → technical term → **models & contracts** (TypeScript + Pydantic) → trace feature code → hands-on rep. One major idea per day.

**Learner preference — models over SQL:** Explain data through **Pydantic contracts** (`backend/app/contracts/`), **domain types** (`frontend/lib/domain-types.ts`), and **feature code** (`get_db().table(...).insert/select`). Do **not** lead with raw `.sql` migration files unless the day is specifically about migrations (Days 5, 29) or the learner asks to see schema SQL.

**Learner preference — complete route:** When showing code, always print the **full path chain first** (every file from UI to database client), then cite snippets with repo-root paths so the learner can open each file on GitHub and follow in order.

**You will touch code.** This course is not concepts-only. By Week 4 you should be able to open a bug report, find the file, trace the path, and propose or make a fix. Concepts explain *why*; code reps build *muscle memory*.

**How to use this course**

1. **This document** is your map. Stay here to see the full four weeks.
2. **Each day** has a spin-off prompt in `docs/engineering/lessons/day-XX.md`.
3. Open a **new Cursor chat**, paste that day's prompt, and complete the lesson there.
4. Return here to pick the next day. Track progress in `docs/engineering/PROGRESS.md`.

**Git branch (all 30 days):** `cursor/engineering-course-28c8`

All lesson progress, glossary updates, and course docs live on this **one branch** for the full four weeks. Do not create a separate branch per day — that splits the learning history. Cloud agents and local work should check out this branch before updating `docs/engineering/`.

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
| Can I fix a bug myself? | Trace UI → API → feature → DB; read tests; run pytest/vitest |

---

## Three layers every day (concept + code)

Each lesson has **three layers**. All three are required — not optional extras.

| Layer | What you do | Goal |
|-------|-------------|------|
| **1. Concept** | Plain English + one-sentence definition | Know *why* the idea exists |
| **2. Code trace** | Follow real files: UI → `*Api.ts` → `http/` → `features/` → **contracts/models** → `get_db()` calls | Know *where* things live |
| **3. Hands-on rep** | Guided exercise (see week progression below) | Build skill to debug and change code |

**Rule:** If a day ends without you opening at least 2–4 real files and naming what each does, the day is not complete.

### Hands-on progression by week

| Week | Code rep focus | Example tasks |
|------|----------------|---------------|
| **1** (Days 1–7) | **Read & trace** — follow a request path; name files | Trace booking create; find where `line_items` is written; run `/health` |
| **2** (Days 8–14) | **Follow auth & external calls** — guards, Stripe, webhooks | Find `require_client`; trace a webhook handler; grep for a secret env var |
| **3** (Days 15–21) | **Run tests & logs** — pytest, vitest, read failures | Run one backend test; break a test on purpose; read a log line to a bug |
| **4** (Days 22–30) | **Debug & fix** — small real or simulated bugs | Fix a typo/guard; add a test; propose a one-file patch |

**Writing new features** is not the main goal of Week 1–2. **Reading structure and tracing flows** is — that's how you fix bugs later. Full "build a feature" practice peaks in Days 20, 26–27, and 30.

### When do we *write* code?

| Situation | Write code? |
|-----------|-------------|
| Daily lesson (Week 1–2) | Usually **no** — trace, annotate, answer "what file next?" |
| Daily lesson (Week 3+) | Often **yes** — run tests, small edits, add a log line |
| You say "implement it" or "help me fix this bug" | **Yes** — pair on a real change |
| Improve Eventtz verdict = "Fix now" | **Optional** — only if you want to ship a fix that day |

You do **not** need to rewrite the whole curriculum or all 30 spin-off files. The rules below apply to **every** day automatically.

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
4. **Code trace** — walk one path file-by-file (UI → API → feature → DB where relevant)
5. Teach the technical term
6. **Hands-on rep** — you do something in the repo (trace, grep, run test, or small edit — see week table above)
7. Break it (realistic problem — you guess first)
8. Teach through questions (one at a time, hints not answers)
9. Show the solution (Eventtz code + what could still go wrong)
10. Compare alternatives (simplest first, when to upgrade)
11. Improve Eventtz (Fix now / Improve later / Leave it alone)
12. Check understanding (explain back in your own words)
13. Update `PROGRESS.md` and `GLOSSARY.md` (include **files traced** and **hands-on rep done**)

> **Note:** Steps were expanded from 12 → 13 to make code trace and hands-on reps explicit. Spin-off prompts still say "12 steps" — they mean this structure.

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
- You will **run Eventtz locally** (frontend + backend) by Week 2 at the latest — tracing in the repo alone is not enough to fix bugs
- You complete each day's **code trace**, **hands-on rep**, and **explain back** before moving on

---

## Files maintained during the course

| File | Purpose |
|------|---------|
| `docs/engineering/CURRICULUM.md` | This file — full 30-day map |
| `docs/engineering/lessons/day-XX.md` | Spin-off prompt per day |
| `docs/engineering/PROGRESS.md` | Your notes per day |
| `docs/engineering/GLOSSARY.md` | Terms in plain English |
| `docs/engineering/CODEBASE_MAP.md` | Quick file-finder for tracing (optional reference) |
