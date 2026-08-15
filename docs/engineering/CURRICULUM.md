# Eventtz Engineering Course

**Goal:** Know the Eventtz codebase well enough to find and fix bugs yourself.

**Branch:** `cursor/engineering-course-28c8` (one branch for everything)

---

## Primary plan — Feature flow track

**Start here:** [FEATURE_TRACK.md](./FEATURE_TRACK.md)

We learn by walking **real features end to end**: UI → `*Api.ts` → contract → `http/` → feature code → `get_db()`.

| # | Slice | Covers (concepts inline) |
|---|-------|--------------------------|
| 1 | **Authentication** | Login, session, `/me`, guards |
| 2 | **Client browse** | Explore, vendor profile (read-only) |
| 3a | **Client booking — enquire** | Models, snapshots, create flow |
| 3b | **Client booking — rest** | Detail, status, adjustments, complete |
| 4 | **Client payment** | Stripe Checkout, sync, webhook |
| 5 | **Vendor quote + accept** | Status machine, vendor initiator |
| 6 | **Vendor payout** | Stripe Connect, payout release |
| 7+ | Chat, notifications, admin… | As needed |

### How each session works

1. Teacher lists the **complete file route** (every path, in order)
2. Walk each file — plain English, models not SQL
3. Mention useful concepts only when they appear in the flow
4. Mark slice done in `PROGRESS.md` / `FEATURE_TRACK.md`
5. **No mandatory tasks** — you follow on GitHub; no hunts or exit tickets unless you ask

### How to start a session

Same chat is fine (recommended). Say e.g.:

```
Teach me Feature Slice 1 — Authentication.
Follow docs/engineering/lessons/_SPINOFF_RULES.md and FEATURE_TRACK.md.
Complete route first, then walk every file.
```

Or use the copy-paste prompt in [lessons/feature-slice-prompt.md](./lessons/feature-slice-prompt.md).

---

## Learner preferences (always)

| Preference | Rule |
|------------|------|
| **Feature-flow first** | Vertical slices, not abstract concept days |
| **Complete route** | Full file paths before any code snippet |
| **Models over SQL** | `contracts/`, `domain-types.ts`, feature code |
| **Descriptive names** | See [NAMING.md](./NAMING.md) |
| **No mandatory tasks** | Teacher-led walkthroughs at your pace |

---

## Supporting docs

| File | Purpose |
|------|---------|
| [FEATURE_TRACK.md](./FEATURE_TRACK.md) | **Primary** — slice order + status |
| [PROGRESS.md](./PROGRESS.md) | Your notes per slice |
| [GLOSSARY.md](./GLOSSARY.md) | Terms in plain English |
| [CODEBASE_MAP.md](./CODEBASE_MAP.md) | Quick paths when debugging |
| [NAMING.md](./NAMING.md) | Naming rules |
| [lessons/_SPINOFF_RULES.md](./lessons/_SPINOFF_RULES.md) | Rules for teacher agents |

---

## Appendix — 30-day concept reference (on hold)

The original concept-by-concept curriculum is kept for **lookup** when a topic comes up in a feature slice (e.g. indexes while tracing explore search). **Do not follow day-by-day unless you choose to.**

<details>
<summary>30-day map (click to expand)</summary>

### Week 1 — How software systems work

| Day | Topic | Key Eventtz areas |
|-----|-------|-------------------|
| 1 | System architecture | `frontend/`, `router.py`, booking flow |
| 2 | Modeling | `contracts/`, `booking_requests` |
| 3 | Databases | `db.py`, migrations |
| 4 | Indexes | `idx_*`, search |
| 5 | Migrations | `backend/sql/` |
| 6 | Concurrency | `calendar.py`, capacity |
| 7 | APIs | `/api/v1`, contracts |

### Week 2 — Safe and correct

| Day | Topic | Maps to feature slice |
|-----|-------|---------------------|
| 8 | Authentication | **Slice 1** |
| 9 | Authorisation | Slices 1, 3–6 (guards) |
| 10 | Security | All slices |
| 11 | Idempotency | **Slice 4** (payment) |
| 12 | External services | Slices 4, 6 |
| 13 | Webhooks | **Slice 4** |
| 14 | Background jobs | Notifications slice |

### Week 3 — Production-ready

| Day | Topic |
|-----|-------|
| 15–21 | Caching, storage, search, logging, errors, testing, deploy |

### Week 4 — Scale and design

| Day | Topic |
|-----|-------|
| 22–30 | Infra, scaling, reliability, codebase organisation, review |

Spin-off prompts (legacy): [lessons/day-01.md](./lessons/day-01.md) … [day-30.md](./lessons/day-30.md)

</details>

---

## Prerequisites

- Basic TypeScript and Python reading ability
- GitHub access to follow file paths
- Local run optional (helpful for payment/auth slices later)
