# `frontend/app/` — Next.js App Router map

This folder defines **URLs and page shells only**. Product UI, state, and API calls live in [`features/`](../features/) and [`lib/`](../lib/). See [`AGENTS.md`](../../AGENTS.md) for repo conventions.

## Route groups (parentheses folders)

Folders wrapped in `(parentheses)` are **route groups**: they organize files on disk but **never appear in the URL**.

| Group | Purpose |
|-------|---------|
| `(marketing)/` | Public landing, blog, legal/compliance pages |
| `(auth)/` | Shared login, register, password reset, email verification |
| `(portal)/` | Logged-in shell for each role (client, vendor, admin) |

Note: `internal/` is a **real URL segment** (not a route group) — dev-only pages like `/internal/ui-kit`.

Docs: [Next.js route groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)

## Three layers

```text
Public (marketing)     →  /, /blog, /compliances/*
Shared auth            →  /login, /register, /forgot-password, …
Role portals           →  /client/*, /vendor/*, /admin/*
```

| URL prefix | Folder | Shell component |
|------------|--------|-----------------|
| `/` (landing), `/blog`, `/compliances` | `(marketing)/` | Site chrome from feature views |
| `/login`, `/register`, … | `(auth)/` | `AuthPageShell` / unified auth views |
| `/client/dashboard`, … | `client/(portal)/` | `PortalShell` (`portal="client"`) |
| `/vendor/dashboard`, … | `vendor/(portal)/` | `PortalShell` (`portal="vendor"`) |
| `/admin/dashboard`, … | `admin/(portal)/` | `AdminShell` |

**Note:** `/client/browse` lives under `client/(portal)/` but uses a lighter browse layout (no full portal nav) for marketplace discovery.

## Folder tree

```text
app/
├── layout.tsx, globals.css, not-found.tsx
├── (marketing)/          → /, /blog/*, /compliances/*
├── (auth)/               → /login, /register, /forgot-password, /reset-password, /verify-email
├── client/(portal)/      → /client/dashboard, /client/bookings, …
├── vendor/(portal)/      → /vendor/dashboard, /vendor/profile, …
├── admin/(portal)/       → /admin/dashboard, /admin/commerce, …
├── internal/ui-kit/      → /internal/ui-kit (dev only; `internal/` is in the URL)
└── api/realtime/stream/  → /api/realtime/stream (SSE proxy; logic in lib/realtimeSseProxy.ts)
```

## Legacy URLs (redirects, not stub pages)

Old bookmarks and email links are handled in [`next.config.ts`](../next.config.ts) — there are **no** redirect-only `page.tsx` files for these paths.

| Legacy URL | Redirects to |
|------------|--------------|
| `/explore` | `/client/browse` (query preserved) |
| `/admin` | `/admin/dashboard` |
| `/admin/vendors`, `/admin/clients` | `/admin/directory?tab=…` |
| `/admin/bookings`, `/admin/financials` | `/admin/commerce?tab=…` |
| `/admin/disputes`, `/admin/reviews`, `/admin/chat` | `/admin/trust?tab=…` |
| `/admin/login` | `/login?next=/admin/dashboard` (or preserves `?next=`) |
| `/admin/forgot-password`, `/admin/reset-password` | unified auth with `?portal=admin` |
| `/client/login`, `/vendor/login` | `/login` |
| `/client/register`, `/vendor/register` | `/register?type=…` |
| `/vendor/onboarding` | `/vendor/profile` |
| `/client/help`, `/vendor/help` (+ subpaths) | role dashboard |

Real admin booking detail pages stay at `/admin/bookings/[id]` under `admin/(portal)/bookings/[id]/`.

## Adding a new route

1. Pick the layer: public → `(marketing)/`, auth → `(auth)/`, logged-in → `<role>/(portal)/`.
2. Add a thin `page.tsx` that composes one feature view (no direct API calls).
3. Register a new backend router in `backend/app/http/router.py` if needed — not in `app/`.

Example: a new client portal page at `/client/wishlist`:

```text
client/(portal)/wishlist/page.tsx  →  import { ClientWishlistView } from "@/features/client/wishlist/…"
```
