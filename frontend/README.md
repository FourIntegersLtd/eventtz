# Eventtz — frontend

Next.js App Router UI for [Eventtz](https://eventtz.com): a UK marketplace connecting clients with African event vendors. Clients browse, enquire, book, and pay; vendors manage profiles, bookings, quotes, and Stripe payouts; admins operate the console (vendors, disputes, support, blog, email testing).

This package talks to the FastAPI backend under **`/api/v1`**. Full-stack architecture and conventions live in the repo root **[`cursor.md`](../cursor.md)** and **[`AGENTS.md`](../AGENTS.md)**.

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 (`app/globals.css` brand tokens) |
| HTTP | Axios via `lib/axios.ts` — cookie session (`withCredentials: true`) |
| Forms / validation | Zod + helpers in `lib/validation/` |
| Rich text (admin blog) | TipTap |
| Charts (admin) | Recharts |
| Analytics | Mixpanel (`lib/mixpanelClient.ts`, optional locally) |
| Tests | Vitest |

**Fonts:** Fraunces + Plus Jakarta Sans in `app/layout.tsx`.

---

## Prerequisites

- **Node.js 20+** and npm
- **Backend running** at `http://127.0.0.1:8000` (see [`backend/README.md`](../backend/README.md))
- Supabase project + env configured on the backend (unless using `LOCAL_AUTH_MODE=true` for mock auth)

---

## Getting started

```bash
cd frontend
cp .env.example .env.local   # or .env — Next.js loads both
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

In a second terminal, start the API from `backend/`:

```bash
cd backend
poetry install
make start   # uvicorn app.main:app --reload on :8000
```

Health check: `GET http://127.0.0.1:8000/health`.

### How API calls reach the backend

Browser requests use **same-origin** paths (`/api/v1/...`). Next.js rewrites them to the FastAPI server (`next.config.ts` → `BACKEND_URL`). That keeps auth cookies first-party, which matters on mobile Safari/Chrome.

Do **not** set `NEXT_PUBLIC_API_URL` in production — cross-origin cookies break mobile login.

---

## Environment variables

Copy **`frontend/.env.example`** to **`.env.local`** (or `.env`).

| Variable | Required | Purpose |
|----------|----------|---------|
| `BACKEND_URL` | Local dev | FastAPI origin for Next.js rewrites (default `http://localhost:8000`) |
| `NEXT_PUBLIC_API_URL` | No | Direct browser → API calls (debug only; omit in prod) |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | No | Mixpanel project token; leave empty to disable tracking locally |
| `NEXT_PUBLIC_MIXPANEL_API_HOST` | EU projects | e.g. `https://api-eu.mixpanel.com` — restart dev server after change |

Backend secrets (Supabase, Stripe, Resend, OpenAI) belong in **`backend/.env`**, not here.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit tests) |
| `npm run test:watch` | Vitest watch mode |
| `npm run optimize-videos` | Compress landing-page videos (`scripts/optimize-landing-videos.sh`) |

---

## Architecture

### Layering (do not invert)

| Layer | Path | Responsibility |
|-------|------|----------------|
| **Routes** | `app/**/page.tsx`, `layout.tsx` | Thin shells: auth gates, portal chrome, compose one feature view |
| **Features** | `features/<domain>/**` | Screens, hooks, formatters owned by a product flow |
| **Shared UI** | `components/ui/**` | Reusable primitives (Modal, inputs, buttons, …) |
| **Shells** | `components/*-shell/` | Client, vendor, admin portal chrome + nav |
| **API & types** | `lib/**` | `*Api.ts` modules, axios, errors, shared TypeScript types |

**Rules**

- Backend HTTP calls go through **`lib/*Api.ts`**, not raw `fetch`/axios in route files.
- **`lib/` must not import from `features/`**.
- New UI: TypeScript + Tailwind; reuse `components/ui/*` before adding duplicates.
- Large pages → extract `features/<domain>/*View.tsx` + hooks (keep `page.tsx` under ~50 lines of logic).

### Directory overview

```
frontend/
├── app/                    # Routes only (thin)
│   ├── page.tsx            # Landing
│   ├── explore/            # Public marketplace
│   ├── blog/               # Published posts
│   ├── compliances/        # Legal policies
│   ├── client/             # Client auth + portal
│   ├── vendor/             # Vendor auth, onboarding, portal
│   └── admin/              # Admin login + console
├── features/               # Product UI by domain
│   ├── landing/, marketplace/, blog/
│   ├── client/, vendor/, admin/
│   ├── bookings/, chat/, disputes/, notifications/, help/, …
│   └── vendor/onboarding/  # Multi-step profile wizard
├── components/             # Shared UI + shells + auth
└── lib/                    # HTTP clients, types, formatters
```

### Portals & main routes

| Portal | Base routes | Examples |
|--------|-------------|----------|
| **Public** | `/`, `/explore`, `/blog`, `/login`, `/register` | Marketplace browse, legal pages |
| **Client** | `/client/*` | Dashboard, browse, bookings, pay, messages, planner, favorites, settings |
| **Vendor** | `/vendor/*` | Dashboard, profile/onboarding, bookings, payments (Stripe Connect), analytics |
| **Admin** | `/admin/*` | Dashboard, commerce, directory, trust, messages, blog CMS, team, audit, email tests |

Notable flows:

- **Bookings & payments** — `features/bookings/*`, `lib/clientBookingsApi.ts`, Stripe Checkout via `lib/bookingCheckoutApi.ts`
- **AI Event Planner** — `/client/planner`, `features/client/planner/`, `lib/clientPlannerApi.ts`
- **Help Center** — `/client/help`, `/vendor/help`, `lib/helpApi.ts`
- **Support chat** — `/client/messages` (DM + “Eventtz Support”); admin inbox at `/admin/messages`

Admin roles (`super_admin` vs `admin`) are enforced in UI via `lib/adminPermissions.ts` and `lib/adminRole.ts`; backend is authoritative.

---

## Styling

- **Tailwind** for all layout and components.
- Brand tokens in **`app/globals.css`**: `--primary`, `--primary-soft`, `--page-bg`, `--accent-gold`, etc.
- Compliance and blog prose: `.compliance-prose`, `.blog-prose`.

---

## Auth

- Session cookies (`eventtz_*`) set by the backend; axios sends them automatically.
- **`components/auth/AuthProvider`** loads `/me` and wires token refresh (`lib/auth-interceptors.ts`).
- Password reset: `/forgot-password` → email link → `/reset-password` (app-owned tokens, not Supabase recovery UI).

---

## Testing

```bash
npm test
```

Prefer unit tests on pure mappers, hooks, and formatters under `features/` and `lib/` rather than full page mounts.

---

## Mobile QA checklist

Before shipping UI changes, smoke-test at **320px**, **390px**, and **768px** (Chrome DevTools) plus one real phone:

| Area | Routes |
|------|--------|
| Public | `/`, `/explore`, `/client/browse`, `/client/browse/[id]`, `/login`, `/register` |
| Client | `/client/dashboard`, `/client/bookings`, `/client/messages`, `/client/notifications`, `/client/settings`, `/client/planner` |
| Vendor | `/vendor/dashboard`, `/vendor/profile`, `/vendor/bookings`, `/vendor/payments`, `/vendor/messages` |
| Admin | `/admin/dashboard`, `/admin/commerce`, `/admin/directory`, `/admin/trust`, `/admin/audit` |

**Pass criteria:** no horizontal page scroll, tap targets ≥44px, modals fit the viewport, master-detail back navigation works on bookings/messages.

---

## Deploy

Production builds are standard Next.js:

```bash
npm run build
npm run start
```

Set `BACKEND_URL` to your production API origin for rewrites. Host the frontend on your chosen platform (e.g. Vercel, Railway); ensure the API `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` include the live site URL.

---

## Related docs

| Doc | Contents |
|-----|----------|
| [`cursor.md`](../cursor.md) | Canonical architecture (backend + frontend) |
| [`backend/README.md`](../backend/README.md) | API setup, env, migrations, deploy |
| [`AGENTS.md`](../AGENTS.md) | Cursor agent entrypoint |
