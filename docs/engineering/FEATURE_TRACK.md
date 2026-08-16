# Eventtz — Feature flow track (primary)

**Branch:** `cursor/engineering-course-28c8`  
**Style:** Teacher-led end-to-end walkthroughs. **No mandatory tasks, hunts, or exit tickets.**

---

## How each session works

1. Pick one **feature slice** (below)
2. Teacher lists the **complete file route** (frontend → backend)
3. Walk each file in order with short plain-English notes
4. Pull **2–3 concepts** out of what we saw (only if useful)
5. Mark slice done in `PROGRESS.md` — move on

**You follow on GitHub** by opening each path in the route list. That's the practice — no extra homework unless you ask.

---

## Order

| # | Slice | Status |
|---|-------|--------|
| 1 | **Authentication** — login, session, `/me`, guards, signup, verify, passwords | **complete** |
| 2 | **Client browse** — explore, vendor profile (read-only) | **complete** |
| 3a | **Client booking — enquire** | **complete** (lesson) |
| 3b | **Client booking — detail, status, adjustments** | **complete** (lesson) |
| 4 | **Client payment** — Checkout + sync + webhook | not started |
| 5 | **Vendor quote + accept/decline** | not started |
| 6 | **Vendor payout** — Stripe Connect | not started |
| 7 | Chat, notifications, email | later |

The 30-day concept map in `CURRICULUM.md` is **on hold** — use it as reference when a concept comes up in a slice.

---

## Slice template (for teacher)

```
## [Feature name]

### User story
One sentence: who does what.

### Complete route
1. frontend/...
2. frontend/lib/...Api.ts
3. backend/app/contracts/...
4. backend/app/features/.../http/...
5. backend/app/features/.../
6. backend/app/core/db.py (if DB)

### Walkthrough
[file by file, brief]

### Concepts in this slice
- ...

### If something broke
First file to open: ...
```

---

## Learner preferences

- Models over SQL
- Complete routes always
- Descriptive names
- **No mandatory tasks**
