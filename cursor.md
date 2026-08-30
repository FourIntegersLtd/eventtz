# Eventtz - architecture index

This is a **short index**. The full architecture reference lives in **[`docs/cursor/architecture-reference.md`](./docs/cursor/architecture-reference.md)** (~800 lines). Use **`@architecture-reference.md`** in chat when you need route tables, feature inventory, or deep conventions.

## How Cursor loads rules

1. **`AGENTS.md`** — short entrypoint (this repo root).
2. **`.cursor/rules/*.mdc`** — scoped rules (auto-loaded by path):
   - `core.mdc` — always apply (~40 lines)
   - `backend.mdc` — `backend/**`
   - `frontend.mdc` — `frontend/**`
3. **Ad hoc** — `@docs/cursor/architecture-reference.md` for full detail.

**Token tips:** [`docs/cursor/token-usage-guide.md`](./docs/cursor/token-usage-guide.md)

## Repository layout

```
eventtz/
├── AGENTS.md              # Short agent entrypoint
├── cursor.md              # This file — index only
├── docs/cursor/           # Full reference + usage guide
├── backend/               # Python (Poetry), FastAPI, Supabase
│   ├── app/
│   └── sql/               # Ordered Postgres migrations
└── frontend/              # Next.js (App Router), TypeScript, Tailwind
```

## Maintainability principles (both stacks)

- **One direction of dependencies:** feature `http/` may import feature logic and `core/`; feature logic must **not** import `http/`. Frontend calls **`lib/*`** for HTTP, not ad-hoc `fetch` in route files.
- **Feature-first:** group by product area (`bookings/`, `chat/`, `auth/`).
- **Reuse before duplicating:** API shapes in **`app/contracts/`** (backend) and **`lib/api-types.ts` / `lib/domain-types.ts`** (frontend).
- **Single registration point:** new FastAPI routers only in **`app/http/router.py`**.
- **Document new env and migrations:** any new **`Settings`** field → **`backend/.env.example`**; DB shape changes → new file under **`backend/sql/`**.
- **Prefer small files:** split modules past ~300–400 lines without a clear single purpose.

## Backend (summary)

- **Stack:** Python 3.13+, Poetry, FastAPI, Pydantic v2, Supabase (`app/core/db.py`).
- **Layout:** `features/<name>/http/` (thin) + `features/<name>/*.py` (logic) + `db*.py`.
- **Auth:** `features/auth/http/guards.py` — `require_client`, `require_vendor`, `require_admin`.
- **Errors:** `AppError` subclasses → `core/errors.py` handler.
- **Run:** `poetry run uvicorn app.main:app --reload` from `backend/`.

See **Backend** section in [`docs/cursor/architecture-reference.md`](./docs/cursor/architecture-reference.md) for feature table, routes, payments, migrations.

## Frontend (summary)

- **Stack:** Next.js App Router, TypeScript, Tailwind, Axios (`lib/axios.ts`, `withCredentials: true`).
- **Layering:** thin `app/**/page.tsx` → `features/<domain>/` → `lib/*Api.ts` for HTTP.
- **UI:** reuse `components/ui/*`; Tailwind + `globals.css` tokens.
- **No raw HTTP in route files** for app APIs.

See **Frontend** section in [`docs/cursor/architecture-reference.md`](./docs/cursor/architecture-reference.md) for route map, `lib/` modules, conventions.

## Quick checklist (new backend feature)

1. Pick or create **`app/features/<name>/`**.
2. Logic in **`features/<name>/*.py`**; DB in **`features/<name>/db*.py`**.
3. Contracts in **`app/contracts/`**.
4. Routes in **`features/<name>/http/`** — thin handlers.
5. Register in **`app/http/router.py`** only.
6. Env → **`backend/.env.example`**; DB → **`backend/sql/NNN_*.sql`**.

## Quick checklist (new frontend feature)

1. Extend **`frontend/lib/<area>Api.ts`**.
2. UI/state in **`frontend/features/<domain>/`**.
3. Reuse **`components/ui/*`** and shells.
4. Document **`NEXT_PUBLIC_*`** in **`frontend/.env.example`** when relevant.

## Anti-patterns to avoid

- **Backend:** Supabase/business rules inline in HTTP routes; importing `http/` from logic; routers outside `http/router.py`.
- **Frontend:** Duplicated API path strings; god `page.tsx` files; raw HTTP in `app/`.

Full anti-patterns and inventory: [`docs/cursor/architecture-reference.md`](./docs/cursor/architecture-reference.md).
