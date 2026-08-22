# Eventtz - instructions for Cursor Agent

Scoped rules in **`.cursor/rules/`** apply automatically:

- **`core.mdc`** — always on (short essentials)
- **`backend.mdc`** — when editing `backend/**`
- **`frontend.mdc`** — when editing `frontend/**`

For deep architecture (route tables, feature inventory, payments, etc.), reference **`@docs/cursor/architecture-reference.md`** or **`@cursor.md`** in chat — do not rely on loading the full doc every turn.

**Token/cost tips:** [`docs/cursor/token-usage-guide.md`](./docs/cursor/token-usage-guide.md)

## Backend (short)

- **Feature logic** lives in **`backend/app/features/<name>/`** - never import from that feature’s `http/` package.
- **HTTP** routes in **`features/<name>/http/`** stay thin: auth guard → feature module → contract / `HTTPException`.
- Register new routers only in **`backend/app/http/router.py`**; API lives under **`/api/v1`**.
- Request/response shapes → **`backend/app/contracts/`**. New settings → **`app/core/config.py`** + **`backend/.env.example`**. Schema changes → **`backend/sql/`** with the next numbered migration.

## Frontend (short)

- Keep **`frontend/app/*`** route files thin; put state, effects, and formatters in **`frontend/features/*`**.
- Reuse **`frontend/components/ui/*`** before adding duplicate primitives in feature folders.
- Keep backend HTTP calls in **`frontend/lib/*`** (`*Api.ts`, shared **`axios`**, **`api-errors`**, **`api-types`**, **`domain-types`**). Avoid raw `fetch`/axios in **`page.tsx`** for app APIs.
- New UI work: prefer **TypeScript** (`.tsx`); split very large pages into smaller modules under the owning feature.

## Maintainability

- Prefer **small, focused diffs** and **reuse** existing helpers and types over copy-paste.
- Avoid **spaghetti**: no god-components, no duplicated API paths, no inverted import layers (see **Anti-patterns** in `docs/cursor/architecture-reference.md`).

When you introduce a **new cross-cutting pattern** (middleware, `lib/` convention, env vars, top-level feature area), update **`docs/cursor/architecture-reference.md`** and the relevant **`.cursor/rules/*.mdc`** in the same change.

## Cursor Cloud specific instructions

The Cloud Agent environment is self-contained via scripts in **`.cursor/`**:

- **`install.sh`** — `poetry install --extras dev` (backend) + `npm ci` (frontend). Toolchain (Python 3.13, Poetry, Node, Docker, Supabase CLI) is baked into the base image/snapshot.
- **`start.sh`** — starts the Docker daemon, then brings up a **local Supabase stack** (`supabase start`, config in **`supabase/`**), applies **`backend/sql/*.sql`** on first boot (+ `supabase-grants.sql`), and writes **`backend/.env`**. If `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are provided as secrets, it uses that hosted project instead of the local stack.
- **`run-backend.sh` / `run-frontend.sh`** — the `terminals` dev servers (FastAPI on `:8000`, Next.js on `:3000`).

Local Supabase Studio is at `http://127.0.0.1:54323`. Run backend tests with `cd backend && poetry run pytest -q` and frontend checks with `cd frontend && npx tsc --noEmit && npm test` (both mock external services, no DB needed).
