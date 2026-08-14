# Backend naming audit — copy-paste prompt

Use in a **new Cursor chat** on branch `cursor/engineering-course-28c8`.

---

## Prompt

```
You are auditing naming across the Eventtz Python backend for clarity and consistency.

## Scope
- `backend/app/` (all features, contracts, core, http)
- Include tests: `backend/tests/`
- Do NOT rename files unless I approve a plan first
- Do NOT change behaviour — naming/refactor only after I sign off

## Git
- Branch: `cursor/engineering-course-28c8`
- Propose changes in small PR-sized batches (one feature area at a time)

## What to audit

### 1. Functions
- Public functions: verb phrases (`create_booking_request`, `get_booking_request_for_client`)
- Private helpers: leading `_` only when truly internal
- Same action → same verb (`get_` vs `fetch_` vs `load_` — pick one pattern per layer)
- HTTP handlers: match route intent (`post_booking_request`, not `create`)

### 2. Variables & parameters
Flag abbreviations that hurt readability:
- `pb`, `li`, `q`, `res`, `row0`, `vid`, `cid`, `bid`, `vpayload`, `raw_adj`
- Single-letter loops except trivial `i` in tiny scopes
- `payload` when it means vendor profile vs request body vs JSON blob — should be specific

Prefer:
- `pricing_breakdown` not `pb`
- `line_item` not `li`
- `search_query` not `q` (unless SQL query builder `q` is idiomatic in that file)
- `booking_row` not `row0`
- `vendor_user_id` not `vid` when it's a user id

### 3. Parameters & contracts
- `backend/app/contracts/` — field names should match DB/API JSON (`snake_case`, explicit units: `_gbp`, `_at`, `_id`)
- Handler `body` params: type name should say what it is (`CreateBookingRequestBody`)
- Avoid duplicate concepts: `user_id` vs `client_user_id` — document when each is correct

### 4. Consistency across layers
| Layer | Path | Naming expectation |
|-------|------|-------------------|
| Contracts | `backend/app/contracts/` | Noun models, `*Body`, `*Response` |
| HTTP | `features/*/http/` | Thin; same names as contracts |
| Service | `features/*/*.py` | `verb_noun` functions |
| DB access | `get_db().table(...)` | Table name strings match SQL tables |

Check:
- `get_db()` vs `get_client()` — prefer `get_db()` in new code
- `users` vs `user` in function names
- `booking_request` vs `booking` — one term per entity

### 5. Module & file names
- Feature folder = product noun (`bookings`, `vendors`, `auth`)
- No vague `utils.py` unless scoped (`_command_helpers.py` is OK if small)

## Deliverables (in order)

1. **Naming rubric** — 10 rules for Eventtz backend (plain English)
2. **Heat map** — table of worst offenders by area:
   - Area (e.g. `bookings/create.py`)
   - Issue type (abbreviation, inconsistent verb, vague `payload`)
   - Example symbol
   - Severity: High / Medium / Low
   - Suggested rename (before → after)
3. **Top 20 renames** — highest impact, lowest risk (no public API break)
4. **Breaking renames** — anything that changes JSON field names or route shapes (do NOT do without migration plan)
5. **One feature pilot** — pick `bookings/` OR `vendors/` and show a focused rename diff plan (no code until I say "implement")

## Output format
- Use full file paths for every example
- Show complete route when citing a symbol (where it's defined + top 3 call sites)
- Models over SQL — refer to `contracts/` not migrations
- Categorise each suggestion: **Fix now** | **Improve later** | **Leave it alone**

## Do not
- Rename for style only (e.g. `idx` → `index`) if it adds churn without clarity
- Touch frontend in this audit
- Run a mega-refactor across the whole backend in one go

Start with deliverable 1 and 2 only. Wait for my approval before implementing renames.
```

---

## After the audit

When you approve renames for one area:

```
Implement the approved naming changes for [bookings/] only.
- One commit per logical group
- Run: `cd backend && poetry run pytest tests/ -q --tb=no` (or targeted tests)
- List any symbols you could not rename safely and why
```
