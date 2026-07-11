# Eventtz backend

FastAPI API for Eventtz (Supabase Postgres, server-side service role). Layering and conventions are documented in the repo root **[`cursor.md`](../cursor.md)** (services vs endpoints, logging, auth).

## Prerequisites

- **Python 3.13+**
- **[Poetry](https://python-poetry.org/)** for dependencies

## Run locally

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

- API base: `http://127.0.0.1:8000`
- Health: `GET http://127.0.0.1:8000/health`
- Versioned routes: **`/api/v1/...`**

## Environment

Copy **`.env.example`** to **`.env`** and set values. Important keys:

| Variable | Purpose |
|----------|---------|
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins (e.g. `http://localhost:3000`) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT (backend only; never expose to the browser) |
| `LOCAL_AUTH_MODE` | `true` = in-memory mock auth (no Supabase); dev only |
| `BOOKING_SERVICE_FEE_PERCENT` | % added to vendor portion for client totals |
| `FRONTEND_URL` | Base URL used to build Stripe Connect `return_url`/`refresh_url` and Checkout `success_url`/`cancel_url` (e.g. `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` locally) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `POST /api/v1/webhooks/stripe` (`whsec_...`) |
| `LOG_LEVEL` | `DEBUG`, `INFO`, … |
| `IS_PRODUCTION` | `true` = compact logs; `false` = detailed logs + `backend/logs/eventtz.log` |

See **`.env.example`** for optional log file tuning (`LOG_DIR`, `LOG_MAX_BYTES`, …).

## Project layout

| Path | Role |
|------|------|
| `app/main.py` | FastAPI app, CORS, mounts **`http/router.py`** at `/api/v1`, `GET /health` |
| `app/http/router.py` | Aggregates all feature HTTP routers |
| `app/core/` | Config, logging, errors, Supabase client (`db.py`) |
| `app/contracts/` | Pydantic request/response models |
| `app/features/<name>/` | Feature modules: `http/` routes + business logic + `db*.py` |

### Routers under `/api/v1`

Registered in [`app/http/router.py`](app/http/router.py). Each maps to a folder under `app/features/`. See `cursor.md` for the bug-tracing guide and full feature table.

## Database (Supabase Postgres)

SQL migrations live in **`sql/`**. Apply them in **numeric order** in the Supabase SQL Editor (or `psql`) against your project database. Earlier files set up users, vendors, approval flow; later ones add booking requests, notifications, chat, pricing/reviews, etc. If you are greenfield, run **001** onward through the latest `0xx_*.sql` you need for the features you use.

Highlights from the original README (still apply):

- **`001_users_and_vendor_onboarding.sql`** — enum `user_type`, `public.users`, `public.vendors` (JSONB profile). Follow with **`002`**–**`003`** if your DB was created from older snippets.
- **`004`** / **`005`** — vendor `approval_status` including `banned`.
- **`006_admin_vendor_list_view.sql`** — admin listing support.
- **`009_disable_rls_public_users_vendors.sql`** — if PostgREST/RLS blocks backend-only tables, run as documented there.

**Admin users:** no public admin signup. Create the user in Supabase Auth, then in the SQL Editor:

```sql
INSERT INTO public.users (id, email, user_type)
VALUES ('<auth.users uuid>', 'admin@example.com', 'admin')
ON CONFLICT (id) DO UPDATE SET user_type = EXCLUDED.user_type, email = EXCLUDED.email;
```

Also set `user_metadata.user_type` to `"admin"` for that user in the Auth dashboard. Staff use the frontend at `/admin/login`.

**403 on `PUT /api/v1/vendor/profile`:** Signed in as a **client**, or `public.users` missing / wrong `user_type`. Fix: use `/vendor/register`, or set `user_type = 'vendor'` for your user, or sign out and back in after signup.

## Role resolution

Guards in `app/api/authz.py` / `deps.py` resolve role from `public.users`, then JWT `user_metadata`, with safe fallbacks. Use these dependencies on protected routes instead of ad-hoc checks.

## Local auth mode

`LOCAL_AUTH_MODE=true` uses in-memory users and sessions (no Supabase). Data resets on restart. Use only for local API testing without a project DB.

## Payments (Stripe Connect)

Vendor onboarding, client Checkout, held funds, and payouts are implemented in `app/services/stripe_service.py` (thin Stripe SDK wrapper) and `app/services/booking_payment_service.py` (business logic: checkout sessions, webhook handlers, mutual-completion payout, admin refund/release). See the **Payments (Stripe Connect)** section in [`cursor.md`](../cursor.md) for the full design (held-funds model, `payment_status` vs `status`, idempotency).

**Setup:**

1. Create a Stripe account and grab a **test-mode** secret key (`sk_test_...`) for `STRIPE_SECRET_KEY`.
2. Run migration `sql/026_stripe_connect_payments.sql` in the Supabase SQL Editor.
3. Set `FRONTEND_URL` to your local frontend origin (e.g. `http://localhost:3000`).

**Testing webhooks locally** with the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe login
stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
```

The CLI prints a `whsec_...` signing secret — set it as `STRIPE_WEBHOOK_SECRET` in `.env` and restart `uvicorn`. Trigger test events with:

```bash
stripe trigger checkout.session.completed
stripe trigger account.updated
```

In production, configure the webhook endpoint (`https://<your-api-domain>/api/v1/webhooks/stripe`) in the Stripe Dashboard and use its signing secret for `STRIPE_WEBHOOK_SECRET`.

## Deploy to Railway (CLI)

Deploy from your machine with the **Railway CLI** — no GitHub connection required. All deploy config lives in **`backend/`**; run every command from that folder.

| File | Purpose |
|------|---------|
| `requirements.txt` | Pinned deps (export from Poetry — see below) |
| `Procfile` | `web` process: uvicorn on `$PORT` |
| `railway.toml` | Health check `/health`, start command |
| `nixpacks.toml` | Python 3.13 + pip install |
| `.railwayignore` | Excludes `.env`, venv, logs from upload |
| `runtime.txt` / `.python-version` | Python 3.13.7 |

**Regenerate `requirements.txt` after dependency changes:**

```bash
cd backend
make requirements
```

### 1. Install and log in

```bash
brew install railway
# or: npm install -g @railway/cli

railway login
```

### 2. Create / link project (once)

```bash
cd backend
railway init          # new project + service
# — or —
railway link          # attach to an existing Railway project
```

This creates a local `.railway/` folder (gitignored).

### 3. Set environment variables

Railway does **not** upload your local `.env`. Set vars on the service:

**Option A — Dashboard:** Railway project → your service → **Variables** → **Raw Editor** → paste contents of `.env.example` filled in (use `KEY=value` lines, no spaces around `=`).

**Option B — CLI (one at a time):**

```bash
cd backend
railway variable set SUPABASE_URL=https://xxx.supabase.co
railway variable set SUPABASE_SERVICE_ROLE_KEY=eyJ...
railway variable set CORS_ALLOWED_ORIGINS=https://your-frontend.com
railway variable set FRONTEND_URL=https://your-frontend.com
railway variable set IS_PRODUCTION=true
railway variable set LOCAL_AUTH_MODE=false
# optional: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OPENAI_API_KEY, GETADDRESS_API_KEY, …
```

List what’s set: `railway variable list`

### 4. Deploy

```bash
cd backend
make deploy
# or: railway up --detach
```

Watch logs: `make deploy-logs` or `railway logs`

### 5. Public URL

```bash
railway domain          # generate *.up.railway.app URL
```

- Health: `GET https://<domain>/health` → `{"status":"ok"}`
- API: `https://<domain>/api/v1/...`
- Stripe webhooks: `https://<domain>/api/v1/webhooks/stripe`

### Redeploy after code changes

```bash
cd backend
make deploy
```

Do **not** commit `.env`. Secrets live only in Railway Variables (or your local `.env` for dev).
