# Eventtz - architecture & patterns for AI assistants

**Full reference** — not auto-loaded on every Agent turn (saves tokens). Loaded via:

- **`@docs/cursor/architecture-reference.md`** or **`@architecture-reference.md`** in chat when needed
- Scoped rules in **`.cursor/rules/`** (`core.mdc`, `backend.mdc`, `frontend.mdc`) cover day-to-day essentials
- Short index: **[`cursor.md`](../../cursor.md)** at repo root

This file describes how we structure and extend the codebase. Follow it when adding features, refactoring, or reviewing changes.

### How this ties into Cursor

Per [Cursor’s rules docs](https://cursor.com/docs/context/rules), **Agent** picks up instructions from:

1. **`AGENTS.md`** in the **repo root** (short entrypoint)
2. **`.cursor/rules/*.mdc`** — `core.mdc` (always), `backend.mdc` / `frontend.mdc` (by path)
3. **This file** — reference with `@architecture-reference.md` when you need route tables or deep detail

**Keep this file in sync** when you add routes, features, or cross-cutting patterns. Also update the relevant `.mdc` rule if conventions change.

---

## Repository layout

```
eventtz/
├── AGENTS.md         # Short agent entrypoint - points here
├── cursor.md         # This file - architecture & patterns (keep in sync with the repo)
├── .github/workflows/ci.yml  # PR + main: frontend tsc/vitest, backend pytest, ci-gate
├── backend/          # Python (Poetry), FastAPI, Supabase (Postgres + Auth + Storage)
│   ├── app/
│   └── sql/          # Ordered Postgres migrations (run in Supabase in order)
└── frontend/         # Next.js (App Router), TypeScript, Tailwind, Axios
```

### CI (GitHub Actions)

Workflow **`.github/workflows/ci.yml`** runs on every **pull request** and on **pushes to `main`**:

| Job | What it runs |
|-----|----------------|
| `frontend` | `npm ci`, `npx tsc --noEmit`, `npm test` (Vitest) |
| `backend` | Poetry + `pytest -q` (no `.env`; `SENTRY_DSN` cleared) |
| `ci-gate` | Aggregator — set as the **only required** branch-protection status |

Hardening: read-only `permissions`, SHA-pinned actions, concurrency with `cancel-in-progress`. ESLint is not in the gate yet (existing debt); typecheck + unit tests are.

---

## Maintainability principles (both stacks)

- **One direction of dependencies:** feature `http/` may import feature logic and `core/`; feature logic must **not** import `http/`. Frontend calls **`lib/*`** for HTTP, not ad-hoc `fetch` in route files.
- **Feature-first:** group by product area (`bookings/`, `chat/`, `auth/`) - not by jargon layers (`infrastructure/`, `repositories/`).
- **Reuse before duplicating:** API shapes in **`app/contracts/`** (backend) and **`lib/api-types.ts` / `lib/domain-types.ts`** (frontend).
- **Single registration point:** new FastAPI routers only in **`app/http/router.py`**; avoid mounting routes from `main.py` except the aggregator and `/health`.
- **Document new env and migrations:** any new **`Settings`** field → **`backend/.env.example`**; DB shape changes → new file under **`backend/sql/`** with the next sequence number.
- **Prefer small files:** if a component or endpoint module grows past ~300-400 lines without a clear single purpose, split by sub-view, step, or sub-route (see landing note below).

---

## Backend (`backend/`)

### Stack

- **Python 3.13+**, **Poetry**, **FastAPI**, **Pydantic v2**, **pydantic-settings**
- **Supabase** (Postgres + Auth + Storage) via **`app/core/db.py`** - `get_supabase()`, `get_db()`, PostgREST helpers (`rows_from_query_result`, `first_row_from_query_result`, **`apply_recent_first_order`**). Naming rules: **[`backend/NAMING.md`](backend/NAMING.md)**.
- **List ordering:** backend list endpoints sort **most recent first** via `apply_recent_first_order()` - default `updated_at DESC, created_at DESC, id DESC`; booking list queries also run `sort_booking_rows_recent_first()` as a safety net. Use `column="created_at"` for append-only feeds (notifications, audit); chat **messages** stay `created_at ASC` (thread order); chat **conversations** use `last_message_at DESC, created_at DESC`.
- **httpx** - outbound HTTP for **OS Places** and **getAddress.io** (not FastAPI-specific; used inside address services)
- **OpenAI** - vendor onboarding bio + portfolio image QA; marketplace search query parsing; Help Center assistant (`openai` package, `features/ai/openai_helpers.py` - prefer `parse_completion` for structured output)
- **Uvicorn:** `poetry run uvicorn app.main:app --reload` from `backend/` (see `pyproject.toml` for pinned ranges)

### Deploy (Railway CLI)

- **Run from:** `backend/` only (`cd backend` before every `railway` command).
- **First time:** `railway login` → `railway init` (or `railway link`).
- **Env vars:** set on Railway (dashboard Raw Editor or `railway variable set`) - local `.env` is **not** uploaded (see `.railwayignore`).
- **Deploy:** `make deploy` / `railway up --detach`.
- **Python / start / health:** same as before (`requirements.txt`, `Procfile`, `GET /health`).

See **`backend/README.md`** for the full CLI walkthrough.

### How to trace a bug (backend)

1. **Find the URL** - frontend `lib/*Api.ts` or OpenAPI docs → identifies the **feature** (e.g. `/api/v1/client/booking-requests` → `features/bookings/`).
2. **Route file** - `features/<name>/http/*.py` - auth via `features/auth/http/guards.py`, then calls feature logic.
3. **Business rules** - `features/<name>/*.py` (e.g. `create.py`, `status.py`, `service.py`).
4. **Database** - `features/<name>/db*.py` or `core/db.py` for the Supabase client.
5. **Request/response shapes** - `contracts/<name>.py`.
6. **App-wide config, logging, errors** - `core/`.

### Layout (feature-first)

| Area | Path | Responsibility |
|------|------|----------------|
| **App shell** | `app/main.py` | FastAPI, CORS, mounts `http/router.py` at `/api/v1`, `GET /health` |
| **Router aggregator** | `app/http/router.py` | **Only** place that `include_router`s feature HTTP modules |
| **Core** | `app/core/` | `config`, `logging`, `constants`, `startup`, `errors`, `db` |
| **Contracts** | `app/contracts/` | Pydantic request/response models; shared literals in `types.py` |
| **Features** | `app/features/<name>/` | One product area per folder - see below |

Each feature follows the same shape:

```
features/<name>/
├── http/       # FastAPI routers (thin: auth → logic → contract)
├── *.py        # Business logic modules
└── db*.py      # Table access for this feature
```

| Feature folder | URLs (prefix `/api/v1`) | Key modules |
|----------------|-------------------------|-------------|
| `auth/` | `/auth/*` | `contracts/auth.py` (`AuthUser`, session contracts), `messages.py` (user-facing auth copy), `http/routes.py`, `http/guards.py`, `accounts.py` (`build_app_user`), `session.py`, `password_reset.py` (Resend one-click forgot/reset) |
| `bookings/` | `/client/booking-requests/*`, `/vendor/booking-requests/*` | `messages.py`, `create.py`, `status.py`, `payments.py` (facade) + `payment_checkout.py` / `payment_finalize.py` / `payment_completion.py` / `payment_refunds.py` / `payment_maintenance.py`, `funnel.py`, `enquiry_reminders.py`, `lifecycle_reminders.py`, `http/client.py` - client create sends **`selected_option_ids` only** (+ optional `client_search_context`); optional **`event_id`** links to **`client_events/`**; prices resolved server-side |
| `client_events/` | `/client/events/*` | `events.py`, `http/routes.py` - client-owned celebrations (`client_events`, migration **057**); booking create auto-creates an event when `event_id` omitted; list/detail include `event_id` + `event_title` |
| `chat/` | `/chat/*` | `service.py` (facade), `dm.py`, `support_admin.py`, `sanitize.py`, `chat_shared.py`, `http/routes.py` - DMs plus **Eventtz Support** threads (`conversations.kind` = `dm` \| `support`, migration 038). User DMs stay plain text; admin support compose/inbox uses TipTap HTML (`metadata.format` = `html`), sanitized on write via `sanitize.py`, rendered in-app (`MessageBody`) and support emails (`body_html`). Migration **071** raises stored body limit for HTML. Users reply in `/chat`; admins own support via `/admin/messages/*`. |
| `notifications/` | `/client/notifications/*`, `/vendor/notifications/*` | `service.py`, `copy.py`, `http/client.py`, `http/vendor.py` |
| `payments/` | `/vendor/payments/*`, `/webhooks/stripe` | `stripe.py`, `http/vendor.py`, `http/webhooks.py` |
| `analytics/` | (internal) | `events.py` - `record_marketplace_event` → `marketplace_events` |
| `vendors/` | `/vendor/*` (profile, analytics), `/vendors/*` (explore) | `messages.py`, `profile.py`, `moderation.py`, **`list_pricing.py`**, `analytics.py`, **`public_metrics.py`** (completed / reply time / conversion for browse), `markets.py`, `taxonomy.py`, `search.py` / `search_ai.py`, **`ranking/`** (`VendorRankingEngine` - Planner first consumer), `http/explore.py`, `http/onboarding_ai.py`, `http/analytics.py` |
| `vendor_copilot/` | `/vendor/copilot/*` | `score.py`, `context.py`, **`brief_cache.py`** (context fingerprint + in-memory LLM narration cache), `brief.py`, `assistant.py`, `demand.py`, `reply_coach.py`, `optimizer.py`, `http/routes.py` - **Vendor Growth Co-pilot**: deterministic Growth Score + daily brief + grounded chat (`OPENAI_COPILOT_MODEL`); post-launch package optimizer; enquiry draft replies. Brief cache: fingerprint busts on profile/booking/analytics changes; frontend stale-while-revalidate + SSE `bookings:refresh`. Suggest-only (vendor approves all changes). Frontend: **`VendorCopilotWidget`** FAB + **`VendorGrowthBriefCard`** on dashboard. Help articles migration **068**. |
| `admin/` | `/admin/*` | `messages.py`, `permissions.py`, `directory_search.py`, `marketplace_analytics.py`, `http/platform.py` (aggregates `platform_*.py` domain routers), `http/vendors.py`, `http/messages.py` (support inbox routes), `http/email.py` - **`super_admin`**: team invite/roles, booking money actions, financials CSV export, dispute resolve with refund/payout, vendor listing force publish/hide, support message audience broadcasts. **`admin`**: vendors/clients (approve/pending/ban, listing revert to auto), disputes triage, reviews, audit, targeted support compose/inbox, blog CMS, marketplace analytics. Frontend: `lib/adminPermissions.ts`. |
| `favorites/` | `/client/favorites/*` | `service.py`, `http/client.py` - client saved vendors |
| `geo/` | `/client/geo/*` | `uk_address.py`, `http/routes.py` |
| `media/` | `/media/*` | `upload.py` - `POST /media/images` (images) and `POST /media/files` (PDF/video/docs for portfolio & certificates) |
| `realtime/` | `/realtime/*` | `sse.py` - server-sent events for chat unread / data refresh |
| `settings/` | `/user/*`, `/client/onboarding` | `contact.py` - contact-sharing prefs; **`apply_counterparty_contact_visibility`** masks email/phone until `payment_status` is paid (`paid`, `payout_released`, or `partially_refunded`); booking venue (`event_address`/`event_postcode`) is **never** masked from vendors. Vendor phone comes from vendor profile payload, not `users.contact_phone`. `client_onboarding.py` - first-visit client onboarding state (`users.preferred_name`, `users.client_onboarding_completed_at`, migration 035); `/me` includes `preferred_name` + `client_onboarding_completed` for clients, and vendor booking APIs expose a friendly `client_display_name` (from `client_display_names_by_id` in `auth/lookup.py` - never the raw email). **`account_deletion.py`** (+ `account_deletion_gates.py`, `account_deletion_erase.py`, `account_deletion_storage.py`) — `POST /user/account/deletion` (password confirm): tombstone `users.deleted_at`, erase PII, never `DELETE` `public.users` / `booking_requests` / DM threads; Auth `delete_user` after migration **077**. Mixpanel profile delete via **`analytics/mixpanel.py`** (httpx). Counterparties keep the booking contract; live names become “Deleted user”. |
| `contact/` | `/client/contact`, `/vendor/contact`, `/admin/contact` | `service.py` + `classification.py` - authenticated support form (message + optional booking ref); LLM classifies subject via OpenAI `chat.completions.parse` (`OPENAI_CONTACT_MODEL`, fallback `other`); persists to `contact_submissions` (migrations 037 + **074** `portal=admin`) and emails admins via `features/email/` (Resend). Bug / booking / payments subjects POST the Cursor automation webhook. Admin **Report a bug** always sends `feedback_bug` (no LLM). |
| `help/` | `/help/*` | `queries.py`, `help_article_keyword_search.py`, `assistant.py`, `http/routes.py` - signed-in Help Center: role-filtered categories/articles (`help_categories` / `help_articles`, migrations **051–082**) for `client` \| `vendor` \| `admin` + AI ask via OpenAI `chat.completions.parse` (`OPENAI_HELP_MODEL`). Content is **SQL seed only** (plain English, polite second-person voice, no em dashes; GitHub-style `> [!NOTE]` / `> [!WARNING]` / `> [!IMPORTANT]` callouts and `### N. Title` numbered steps). Portal money/dispute → escalate to Contact; admin escalate → **Report a bug**. Primary UX: **`HelpWidget` FAB** (standalone `/client/help` and `/vendor/help` redirect to dashboard). No TipTap CMS for help in v1. |
| `planner/` | `/client/planner/*` | `plan_service.py`, `prompt_parser.py`, `category_planner.py`, `explore_vendor_adapter.py`, `budget.py`, `confidence.py`, `planner_summary_generation.py`, `db.py`, `http/routes.py` - AI Event Planner: one prompt → persisted celebration plan (`celebration_plans` / `celebration_plan_items`, migration 055). Intent `simple` → `ValidationError(code=simple_intent)` (use Browse). Ranking via **`vendors/ranking/`** (`VendorRankingEngine`); LLM only parses brief + grounded explanations (`OPENAI_PLANNER_MODEL`). |
| `blog/` | `/admin/blog/*`, `/blog/*` | `service.py`, `sanitize.py`, `http/admin.py`, `http/public.py` - admin TipTap CMS (draft/publish) + public published posts; images via `/media/images`. No newsletter/comments in v1. |
| `referrals/` | `/admin/referrals/*`, `/referrals/partners/{slug}` | `partners.py`, `attribution.py`, `referral_partner_admin_queries.py`, `links.py` - admin-created creator signup links (`?ref=slug` on `/vendor/register`); **`referral_attributions.shoutout_completed`** for shoutout tracking. Share links always use **`https://www.eventtz.com`** (`links.referral_register_url`). Signup: optional **`referral_code`** on `POST /auth/signup` (vendor only). Frontend cookie: **`lib/referralAttribution.ts`**. Migration **`064_referral_partners.sql`**. |
| `email/` | (internal) | `constants.py`, `branding.py` (Eventtz colors; showcase images on S3 in `EMAIL_IMAGES`), `resend_client.py`, `render.py`, `service.py`, `delivery_log.py`, `dispatch.py` - Jinja templates under `templates/` with shared full-width white chrome in `partials/transactional/layout.html` and matching marketing `email_layout_open.html`; `partials/email/account_footer.html` for customer footers; `partials/email/bottom_spacer.html` prevents mobile footer clipping; `admin/alert.html` uses ops footer + type chips. Welcome keeps marketing body blocks; receipts inherit transactional shell. **`dispatch_booking_notification`** writes in-app notification + participant email; **`send_welcome_email`** after email verify (client/vendor); **`send_password_reset_email`** / **`send_email_verification_email`** for one-click links. Admin ops alerts to hardcoded ops inboxes. Env: **`RESEND_API_KEY`** (no-op when unset or `EMAIL_ENABLED=false`). Dedupe: `040_email_delivery_log.sql`. |
| `ai/` | (internal) | `openai_helpers.py` - shared OpenAI client; `extract_json_object` + **`parse_completion`** (Pydantic structured output) for onboarding, marketplace search, Help Center, AI Event Planner, Vendor Growth Co-pilot |

**Rules**

- Feature logic must not import from feature `http/`.
- HTTP routes stay thin: validate → feature module → response / `HTTPException`.
- User-facing API copy (errors, success `message` fields) lives in feature **`messages.py`** or **`copy.py`** — not inline in `http/` or scattered across logic modules. Import as `from app.features.<name> import messages as …_messages`. Shared booking strings: import from **`bookings/messages.py`** (e.g. admin reuses `INVALID_BOOKING_ID`). Notifications feed bodies stay in **`notifications/copy.py`**.
- Reuse literals from **`app/contracts/types.py`** (`UserType`, etc.).
- Auth guards: call **`require_client(request, response)`** directly (canonical); `Depends(...)` only when injecting alongside other deps - see `features/auth/http/guards.py`.
- Raise **`AppError`** subclasses from feature logic; global handler in **`core/errors.py`** maps to HTTP.

### Full directory tree (`backend/app/`)

```
backend/
├── pyproject.toml
├── README.md
├── tests/                      # pytest smoke tests (GET /health)
├── .env / .env.example
├── logs/
├── sql/                        # Numbered migrations
└── app/
    ├── main.py
    ├── core/
    │   ├── config.py
    │   ├── logging.py
    │   ├── constants.py
    │   ├── startup.py
    │   ├── errors.py           # AppError + register_error_handlers
    │   └── db.py               # Supabase client, get_db(), rows_from_query_result(), first_row_from_query_result()
    ├── contracts/              # Pydantic API shapes (was schemas/)
    │   ├── types.py            # UserType, VendorApprovalStatus (was domain.py)
    │   ├── booking.py, chat.py, vendor.py, …
    ├── http/
    │   └── router.py             # Aggregates features/*/http routers
    └── features/
        ├── auth/
        │   ├── http/             # routes.py, guards.py, dependencies.py
        │   ├── session.py, accounts.py, lookup.py, supabase.py
        │   └── db_users.py, db_vendors.py
        ├── bookings/
        │   ├── http/             # client.py, vendor.py, disputes_http.py
        │   ├── create.py, status.py, queries.py, payments.py, reviews.py, …
        │   └── db.py
        ├── chat/
        │   ├── http/             # routes.py, handlers.py
        │   ├── service.py
        │   └── db*.py
        ├── blog/                 # admin + public CMS
        ├── contact/, email/, help/
        ├── notifications/, payments/, vendors/, admin/, geo/, media/, realtime/, settings/, ai/
        └── …
```

### Router registration order (`app/http/router.py`)

Order in code (matters if paths could overlap; several admin routers share **`prefix="/admin"`**):

1. `auth`  
2. `client_favorites` → **`/client/favorites`**  
3. `client_events` → **`/client/events`**  
4. `contact` (client + vendor routers)  
4. `chat`  
5. `user_settings`  
6. `client_onboarding_settings` → **`/client/onboarding`**  
7. `vendor_profile`  
8. `vendor_onboarding_ai`  
9. `vendor_analytics` → **`/vendor/analytics`**  
10. `vendor_copilot` → **`/vendor/copilot/...`**  
11. `vendor_bookings`  
11. `admin_vendors` → **`/admin/vendors/...`**  
12. `admin_platform` → dashboard, bookings, financials, marketplace-analytics, clients, directory search, disputes, reviews, team, audit, support-hold, payment recovery  
13. `admin_email` → **`/admin/email/...`**  
14. `admin_messages` → **`/admin/messages/...`** (Eventtz Support compose + inbox)  
15. `admin_blog` → **`/admin/blog/...`**  
16. `public_blog` → **`/blog/...`**  
17. `vendors_explore`  
18. `client_booking_requests`  
19. `client_geo`  
20. `help` → **`/help/...`**  
21. `client_planner` → **`/client/planner/...`**  
22. `client_notifications`  
23. `vendor_notifications`  
24. `vendor_payments`  
25. `media`  
26. `realtime`  
27. `stripe_webhooks`  

### HTTP routes (full URL base: `/api/v1`)

| Module | `APIRouter` prefix | Tags | Purpose (high level) |
|--------|-------------------|------|------------------------|
| `features/auth/http/routes.py` | `/auth` | `auth` | Sign up, sign in, refresh, sign out, session cookies, `/me`, **forgot/reset/change-password** |
| `features/favorites/http/client.py` | `/client` | `client` | Favorites list/add/remove |
| `features/client_events/http/routes.py` | `/client` | `client` | **`GET /events`**, **`GET /events/{id}`** - active celebrations for smart prefill |
| `features/contact/http/routes.py` | `/client`, `/vendor`, `/admin` | `client` / `vendor` / `admin` | **`POST /contact`** - authenticated support form; admin body is message-only (`feedback_bug`) |
| `features/chat/http/routes.py` | `/chat` | `chat` | Conversations/messages (DM + support), unread count, read markers |
| `features/settings/http/routes.py` | `/user` | `user` | Contact-sharing prefs |
| `features/settings/http/client_onboarding.py` | `/client` | `client` | Client onboarding preferred name / complete |
| `features/vendors/http/profile.py` | `/vendor` | `vendor` | Vendor profile GET/PUT (onboarding payload in `vendors`) |
| `features/vendors/http/onboarding_ai.py` | `/vendor/onboarding/ai` | `vendor-onboarding-ai` | Generate bio, analyze portfolio image (OpenAI) |
| `features/vendors/http/analytics.py` | `/vendor` | `vendor` | **`GET /analytics`** - vendor marketplace funnel stats |
| `features/bookings/http/vendor.py` | `/vendor` | `vendor` | Vendor booking list/detail, status, adjustments, quotes, **`confirm-completion`**; list accepts **`status=`** |
| `features/admin/http/vendors.py` | `/admin` | `admin` | **`GET/PATCH /admin/vendors/...`**, insights, approval |
| `features/admin/http/platform.py` | `/admin` | `admin` | Dashboard/metrics, bookings (+ payment recovery / support-hold), financials, **`GET /marketplace-analytics`**, clients, **`GET /directory/search?q=`**, disputes (`?status=`), reviews, **team** (`/team`), **audit** (`?category=&offset=&limit=`), dispute chat lookup |
| `features/admin/http/email.py` | `/admin` | `super_admin` | Email health check: one transactional smoke test with editable body; advanced layout previews (welcome, auth, admin alert) |
| `features/admin/http/messages.py` | `/admin` | `admin` | Support messaging: `POST /messages/send`, conversations list/reply/read |
| `features/blog/http/admin.py` | `/admin/blog` | `admin-blog` | Blog CMS CRUD + publish/unpublish |
| `features/blog/http/public.py` | `/blog` | `blog` | Published list + get-by-slug (`body_html` only; never editor JSON) |
| `features/vendors/http/explore.py` | `/vendors` | `vendors` | Public explore: list, **search** (LLM parse when `q` set), vendor detail, public reviews |
| `features/bookings/http/client.py` | `/client` | `client` | Client bookings (list **`status=`**, payments filters as needed), reviews, cancel, disputes, **`checkout`**, **`confirm-completion`** |
| `features/geo/http/routes.py` | `/client/geo` | `client-geo` | Address autocomplete / resolve / find (OS Places + getAddress.io) |
| `features/help/http/routes.py` | `/help` | `help` | Categories/articles by audience; article by slug; **`POST /ask`** (structured AI reply) |
| `features/planner/http/routes.py` | `/client/planner` | `client-planner` | AI Event Planner: **`POST /plans`**, list/get, replace item, archive |
| `features/notifications/http/client.py` | `/client` | `client` | Client booking notifications |
| `features/notifications/http/vendor.py` | `/vendor` | `vendor` | Vendor booking notifications |
| `features/media/http/routes.py` | `/media` | `media` | **`POST /images`**, **`POST /files`** → Supabase Storage |
| `features/payments/http/vendor.py` | `/vendor/payments` | `vendor-payments` | Stripe Connect Express onboarding + status + payout ledger (`GET /history`) |
| `features/realtime/http/routes.py` | `/realtime` | `realtime` | SSE stream for live UI refresh |
| `features/payments/http/webhooks.py` | `/webhooks` | `stripe-webhooks` | **`POST /stripe`** - signature-verified; checkout / Connect account events |

**Jobs** (`app/jobs/`): booking maintenance runs **inside the API** on an hourly asyncio loop when `IS_PRODUCTION=true` (`app/jobs/scheduler.py`, started from `main.py` lifespan). A `job_runs` row (migration **075**) claims each UTC hour so two processes do not both run. The same work is still a CLI: `PYTHONPATH=. python -m app.jobs.run_booking_maintenance`.

| Module | Purpose |
|--------|---------|
| `run_booking_maintenance.py` | Hourly: post-event completion reminders + 48h payout auto-release + mark stale pending client enquiries `VENDOR_NO_RESPONSE` after `ENQUIRY_RESPONSE_SLA_HOURS` + enquiry nudges + one-shot lifecycle reminders |
| `scheduler.py` / `lock.py` | In-process loop + `job_runs` claim (no host cron) |

*(Implementations add path segments after the prefix; grep `@router` in each file when adding routes.)*

### Contracts (`app/contracts/`)

| Module | Typical contents |
|--------|------------------|
| **`types.py`** | `UserType`, shared literals (was `schemas/domain.py`) |
| **`geo_address.py`** | Address autocomplete, resolve, find response models |
| **`vendor.py`** | Vendor profile / explore DTOs |
| **`booking.py`** | Booking requests, line items, pricing payloads |
| **`disputes.py`**, **`reviews.py`**, **`chat.py`**, **`admin.py`**, **`admin_messages.py`**, **`payments.py`**, **`marketplace_search.py`**, **`blog.py`**, **`help.py`**, **`planner.py`**, … | Feature-specific API shapes |

### Feature modules - where logic lives

| Feature folder | Key logic modules |
|----------------|-------------------|
| **`features/auth/`** | `messages.py`, `session.py`, `accounts.py`, `lookup.py`, `supabase.py`, `password_reset.py` |
| **`features/bookings/`** | `create.py`, `status.py`, `queries.py`, `payments.py` (+ `payment_*` modules), `funnel.py`, `enquiry_reminders.py` (1h/6h/24h vendor nudges + 24h client alternatives), `lifecycle_reminders.py` (event tomorrow, pay-to-confirm, payouts setup), `reviews.py`, `completion_rules.py`, `pricing_refresh.py`, `disputes.py` |
| **`features/chat/`** | `dm.py` + `support_admin.py` + `sanitize.py` (+ `service.py` re-exports); admin send lives in `admin/http/messages.py` calling into chat. Frontend admin compose: **`SupportRichTextEditor`**; render: **`lib/renderMessageBody.tsx`** (`metadata.format === "html"`) |
| **`features/vendors/`** | `profile.py`, `moderation.py`, **`visibility.py`** (the marketplace visibility rule - see below), `markets.py`, `taxonomy.py`, `analytics.py`, `search.py` (exact → related → fallback + `match_tier`/`match_notice`), `search_ai.py`, `onboarding_ai.py`, `list_pricing.py`, `payload_validation.py`, **`ranking/`** (`VendorRankingEngine` - Planner first; weights in `ranking/weights.py`) |
| **`features/planner/`** | `plan_service.py`, `prompt_parser.py`, `category_planner.py`, `explore_vendor_adapter.py`, `budget.py`, `confidence.py`, `planner_summary_generation.py`, `db.py` - AI Event Planner (migration **055**) |
| **`features/ai/`** | `openai_helpers.py` - shared OpenAI client + JSON extract + **`parse_completion`** |
| **`features/help/`** | `queries.py`, `help_article_keyword_search.py`, `assistant.py` - Help Center browse + grounded AI ask |
| **`features/admin/`** | `dashboard_queries.py`, `booking_ops.py`, `booking_recovery.py`, `directory_search.py`, `dispute_ops.py`, `team_ops.py`, `audit.py`, `permissions.py`, `marketplace_analytics.py`, … |
| **`features/blog/`** | `service.py`, `sanitize.py` - draft/publish CMS; HTML allowlist on write |
| **`features/favorites/`** | `service.py` - client saved vendors (`/client/favorites`) |
| **`features/client_events/`** | `events.py` - `client_events` CRUD helpers, `resolve_event_for_booking` (migration **057**); linked from `bookings/create.py` |
| **`features/analytics/`** | `events.py` - marketplace event log writes |
| **`features/email/`** | `constants.py`, `resend_client.py`, `render.py`, `service.py`, `delivery_log.py`, `dispatch.py`, `templates/` |
| **`features/payments/`** | `stripe.py` |
| **`features/geo/`** | `uk_address.py`, `os_places.py`, `getaddress.py` |
| **`features/notifications/`** | `service.py`, `copy.py`, `feed.py` - feed assembly (booking + dispute + chat summary); HTTP stays thin |
| **`features/settings/`** | `contact.py`, `client_onboarding.py` |
| **`features/media/`** | `upload.py` |
| **`features/realtime/`** | `sse.py` |

### Auth, cookies, deps

- **Cookies:** `app/core/constants.py` - `ACCESS_COOKIE_NAME`, `REFRESH_COOKIE_NAME` (`eventtz_*`).
- **AI models:** `OPENAI_BIO_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_SEARCH_MODEL`, **`OPENAI_HELP_MODEL`** (Help Center assistant), **`OPENAI_PLANNER_MODEL`** (AI Event Planner brief + explanations), **`OPENAI_COPILOT_MODEL`** (Vendor Growth Co-pilot), **`OPENAI_CONTACT_MODEL`** (contact form subject classification).
- **Session:** `features/auth/session.py` - cookie read/write, `get_current_user_or_raise`.
- **Guards:** `features/auth/http/guards.py` - `require_user`, `require_client`, `require_vendor`, `require_admin`.
- **Depends:** `features/auth/http/dependencies.py` - `SupabaseAuthServiceDep`, `get_current_user_dep` when using FastAPI `Depends(...)`.

### Settings & env (`app/core/config.py`)

Document every field in **`backend/.env.example`**. Current groups:

| Area | Fields |
|------|--------|
| CORS | `CORS_ALLOWED_ORIGINS` |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Logging | `LOG_LEVEL`, `IS_PRODUCTION`, `LOG_DIR`, `LOG_FILE_NAME`, `LOG_MAX_BYTES`, `LOG_BACKUP_COUNT` |
| Bookings | adjustment caps (`BOOKING_MAX_ADJUSTMENT_*`), `BOOKING_PAYOUT_AUTO_RELEASE_HOURS_AFTER_EVENT`, `ENQUIRY_RESPONSE_SLA_HOURS` - **service fee %** is `BOOKING_SERVICE_FEE_PERCENT` in `app/core/constants.py` |
| Media | `MEDIA_IMAGES_BUCKET`, `MEDIA_MAX_FILE_UPLOAD_BYTES` (default **50MB** for video/PDF). Image uploads have **no app-level size limit** (`POST /media/images`). |
| OpenAI | `OPENAI_API_KEY`, `MARKETPLACE_SEARCH_AI_CACHE_TTL_SECONDS`, `MARKETPLACE_SEARCH_AI_CACHE_MAX_ENTRIES` - model ids in `app/core/constants.py` |
| UK addresses | `OS_PLACES_API_KEY`; `GETADDRESS_API_KEY` (fallback if OS empty) |
| Frontend base URL | `FRONTEND_URL` - used to build Stripe `return_url`/`refresh_url` (Connect onboarding) and Checkout `success_url`/`cancel_url` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (see **Payments (Stripe Connect)** below) |
| Email (Resend) | `RESEND_API_KEY` only - sender, admin recipients, and enable flag live in `features/email/constants.py` |
| Sentry | `SENTRY_DSN` - empty = no-op (SDK not initialized). `IS_PRODUCTION` maps to Sentry `environment`. Init in `app/core/sentry.py` before the FastAPI app; `/health` is not sampled as a transaction. |
| Cursor Automations | `CURSOR_AUTOMATION_WEBHOOK_URL` (empty = no-op), `CURSOR_AUTOMATION_WEBHOOK_SECRET` (optional Bearer). Fired after persist for `feedback_bug` / `booking_problem` / `payments` (`CURSOR_AUTOMATION_SUBJECTS` in `contracts/contact.py`). Best-effort; never fails the contact API. |
| Uptime | External UptimeRobot HTTP monitor on `GET /health` (email). Railway healthcheck on the same path restarts the process only. See `backend/README.md`. |

### Logging

- **`get_logger(__name__)`** after `setup_logging()` in **`main`**.
- **`IS_PRODUCTION=true`**: compact one-line logs.
- **`IS_PRODUCTION=false`**: multi-line “banner” logs. File + stdout under **`backend/logs/`** by default.
- Never log secrets or full auth payloads.

### SQL migrations (`backend/sql/`)

Run in **numeric order** in Supabase (new changes → next `NNN_description.sql`):

| File | Topic |
|------|--------|
| `001_users_and_vendor_onboarding.sql` | Core users + vendor onboarding |
| `002_drop_display_name_from_users.sql` | Schema tweak |
| `003_rename_vendor_onboarding_to_vendors.sql` | `vendors` table |
| `004_vendors_approval_status.sql` | Approval enum |
| `005_allow_banned_vendor_approval_status.sql` | Banned state |
| `006_admin_vendor_list_view.sql` | Admin listing support |
| `009_disable_rls_public_users_vendors.sql` | RLS off for backend-owned tables |
| `010_booking_requests.sql` | Booking requests table |
| `011_booking_completed_and_notifications.sql` | Completed + notifications |
| `012_booking_notification_cancelled.sql` | Cancelled notification |
| `013_booking_paid_at.sql` | Payment timestamp |
| `014_chat_conversations_messages.sql` | Chat |
| `015_booking_vendor_adjustments.sql` | Vendor adjustments JSON |
| `016_booking_notifications_body_and_pricing_kind.sql` | Notification payload |
| `017_booking_reviews.sql` | Reviews |
| `018_admin_console.sql` | Admin-related DB |
| `019_booking_vendor_initiator.sql` | Quote initiator |
| `020_booking_event_postcode.sql` | `event_postcode` |
| `021_dispute_one_active_per_booking.sql` | Dispute constraint |
| `022_dispute_conversation_id.sql` | Dispute + chat link |
| `023_storage_bucket_eventtz_images.sql` | Storage bucket |
| `024_booking_event_address.sql` | `event_address` |
| `025_ensure_booking_event_postcode_address.sql` | Idempotent postcode+address ensure |
| `026_stripe_connect_payments.sql` | Stripe Connect + payments: `vendors.stripe_*` columns, `booking_requests.payment_status` + payout/completion columns, `stripe_webhook_events` dedupe table, `dispute_cases.resolution_action`/`refund_amount_gbp` |
| `027_message_quote_metadata.sql` | `messages.metadata` jsonb for quote cards / structured chat payloads |
| `028_contact_sharing_preferences.sql` | `users.contact_phone` + `share_email` / `share_phone` / `share_address` |
| `029_seed_vendor_reviews.sql` | Seed / sample reviews (dev/demo) |
| `030_booking_requests_updated_at_index.sql` | Index supporting recent-first booking lists |
| `031_admin_team.sql` | `users.admin_role` (`super_admin` \| `admin`) + team bootstrap |
| `032_vendor_business_name_unique.sql` | Unique vendor business name (+ verify companion `032_verify_…`) |
| `033_booking_daily_capacity.sql` | Concurrency-safe `maxBookingsPerDay` trigger (advisory locks per vendor/day) |
| `034_initial_client_total_label.sql` | Snapshot of client total at request creation (price-update UX) |
| `035_client_preferred_name.sql` | `users.preferred_name` + `users.client_onboarding_completed_at` (client onboarding) |
| `036_booking_cancel_completion.sql` | Cancellation audit (`cancelled_by`/`cancelled_at`) + 48h auto-release/reminder tracking (`payout_auto_released_at`/`completion_reminder_sent_at`), partial index for the maintenance scan, and updated `booking_notifications` kind constraint (adds completion reminder + updated-price kinds) |
| `037_contact_submissions_and_support_hold.sql` | `contact_submissions` table + `booking_requests.support_hold` (pauses auto-release) |
| `074_contact_submissions_admin_portal.sql` | `contact_submissions.portal` also allows `admin` (staff bug reports) |
| `075_job_runs.sql` | `job_runs` unique `(job_name, period_key)` for in-process hourly maintenance lock |
| `076_high_impact_reminders.sql` | `event_tomorrow_reminded_at`, `pay_to_confirm_reminded_at`; `vendors.approved_at`, `payouts_setup_nudge_at`; notification kinds `event_tomorrow` / `vendor_event_tomorrow` / `pay_to_confirm` |
| `077_account_deletion.sql` | `users.deleted_at` tombstone; drop `users` → `auth.users` CASCADE; shared booking/chat/review/dispute/vendor FKs `ON DELETE RESTRICT` |
| `078_payout_held_connect_incomplete.sql` | Notification kind `payout_held_connect_incomplete` when both parties confirmed but Connect cannot receive a Transfer yet |
| `079_help_center_product_gaps.sql` | Help Center: account deletion, receipts, payout hold, reminders, admin report-bug; vendor Account category; related_slug fixes for 068 |
| `080_help_center_ferndesk_tone.sql` | Help Center: Ferndesk-style plain English rewrite of all articles (**74**); NOTE/WARNING callouts; numbered step headings; UPDATE only |
| `081_help_center_callouts.sql` | Help Center: NOTE/WARNING/IMPORTANT callouts on ~28 high-impact articles; UPDATE only |
| `082_help_center_kind_tone.sql` | Help Center: kinder, polite plain-English tone pass on all **74** articles and category descriptions; UPDATE only |
| `038_support_conversations.sql` | Support chat: `conversations.kind` (`dm`\|`support`), `support_user_id`, `admin_last_read_at`, partial unique indexes |
| `039_blog_posts.sql` | `blog_posts` (slug, TipTap `body_json`, sanitized `body_html`, status draft/published, cover, excerpt) |
| `040_email_delivery_log.sql` | `email_delivery_log` - dedupe index on `(template_id, booking_id, recipient_user_id)` for retryable booking lifecycle emails |
| `041_client_saved_vendors.sql` | `client_saved_vendors` - server-side favorites |
| `042_explore_search_columns.sql` | Denormalized `min_list_price_gbp`, `base_city_normalized`, `services_offered` + approved vendor index |
| `043_vendor_market_location.sql` | `vendors.country_code`, `vendors.currency`, `booking_requests.currency` (default GBP/GB); composite explore index on `(country_code, base_city_normalized)` |
| `044_blog_author_name.sql` | `blog_posts.author_name` - public “By …” display name |
| `045_enable_rls_all_public_tables.sql` | Enable RLS on public tables (prefer over leaving 009-only); see Auth RLS note |
| `046_booking_funnel_analytics.sql` | Funnel timestamps on `booking_requests` (`accepted_at`, `vendor_first_response_at`, `payment_requested_at`, `completed_at`, `failure_reason`, …) + backfill |
| `047_marketplace_events.sql` | `marketplace_events` table for profile views and funnel event log |
| `048_enquiry_response_reminders.sql` | Enquiry response friction: `enquiry_reminder_{1h,6h,24h}_at`, `client_no_response_nudge_at`, `client_search_context`; notification kinds + marketplace events for vendor/client nudges and multi-enquire |
| `049_password_reset_tokens.sql` | `password_reset_tokens` - hashed one-click reset tokens (Resend email, 60m expiry, single use) |
| `050_dispute_party_resolution_notes.sql` | Per-party dispute resolution notes (`client_resolution_note` / `vendor_resolution_note`) |
| `051_help_center.sql` | `help_categories` + `help_articles` (audience `client`\|`vendor`\|`both`) + seeded Help Center content |
| `052_help_center_expand_articles.sql` | Longer step-by-step Help articles (upsert by slug); corrects vendor Stripe timing (Connect at accept, not go-live) |
| `053_help_center_admin.sql` | Audience `admin` + seeded admin console walkthrough categories/articles |
| `054_help_center_plain_english.sql` | Rewrites Help articles in plain English (lay terms); upsert by slug |
| `065_help_center_admin_gating.sql` | Patches admin role and broadcast gating copy (superseded in part by 067) |
| `066_help_center_stripe_listing.sql` | Patches admin listing hide vs Connect (superseded in part by 067) |
| `067_help_center_feature_alignment.sql` | Adds planner, onboarding AI, admin directory workflows, referrals articles; rewrites 8 stale articles; plain English, no em dashes (**64 articles** across client/vendor/admin) |
| `068_vendor_growth_copilot_help.sql` | Vendor Growth Co-pilot help articles (`vendor-growth-copilot`, `vendor-growth-score-explained`) |
| `069_help_center_unified_admin_login.sql` | Help Center: unified admin login URL copy |
| `070_vendor_pending_messages_access.sql` | Help Center: pending vendors can open Messages (Eventtz Support) before approval |
| `071_message_rich_body_len.sql` | Raise `messages.body` storage limit for sanitized admin support HTML |
| `055_celebration_plans.sql` | AI Event Planner: `celebration_plans` + `celebration_plan_items` |
| `057_client_events.sql` | `client_events` table + `booking_requests.event_id` FK - multi-vendor planning under one celebration |
| `058_celebration_plans_client_event.sql` | `celebration_plans.client_event_id` FK - planner handoff creates event before first booking |
| `059_booking_review_images.sql` | `booking_reviews.image_urls` text[] - client photo attachments on reviews (Amazon-style, max 5 in app) |
| `060_email_verification.sql` | `users.email_verified_at` + `email_verification_tokens` - client/vendor must verify email before sign-in (backfills existing users) |
| `061_vendor_public_listing_index.sql` | Partial index for the marketplace visibility gate (approved + Stripe charges/payouts enabled) |
| `062_vendor_listing_override.sql` | `vendors.listing_override` (`auto`\|`visible`\|`hidden`) + audit columns; admin can waive the Stripe gate or take a listing down without banning. Rebuilds `vendors_public_listing_idx` to match the new predicate |
| `064_referral_partners.sql` | `referral_partners` + `referral_attributions` - admin-created creator signup links; `shoutout_completed` per referred vendor |

### Client events (multi-vendor planning)

- **Table:** `client_events` (title, dates, venue, `status` active/archived) - migration **057**.
- **Booking link:** `booking_requests.event_id` optional FK; denormalized `event_name` / `event_date` / address columns remain on the booking row for vendor views.
- **Planner handoff:** **`POST /client/planner/plans/{id}/ensure-event`** creates or returns `client_events` from plan title/date/location; stores `celebration_plans.client_event_id`. Browse/book flows pass `event_id` in URL; **`useActiveEventPrefill({ linkedEventId })`** auto-applies without banner.
- **Create flow:** `POST /client/booking-requests` accepts optional **`event_id`**. When omitted, `resolve_event_for_booking` creates a new `client_events` row from the submitted event fields. When set, copies fields from the existing event (rejects archived/missing).
- **List API:** client booking list rows include **`event_id`** + **`event_title`** for grouped UI.
- **Frontend:** `lib/clientEventsApi.ts` + `useActiveEventPrefill` banner in booking modals; `groupBookingsByEvent` sections in **`ClientBookingsView`** active tab.
- **AI planner:** hand off to **`/client/browse`** with `vendor_ids` + `event_id`; recommended vendors pre-selected; same booking UX as non-AI browse.
- **Graceful degradation:** if migration 057 is not applied, event list returns `[]`; run **`057_client_events.sql`** and **`058_celebration_plans_client_event.sql`** in Supabase.

### Marketplace analytics

- **Enquiry** = `booking_requests` with `initiator='client'` (not a separate table).
- Funnel columns + `failure_reason` written from booking/status/chat/payments paths (`bookings/funnel.py`).
- SLA: `ENQUIRY_RESPONSE_SLA_HOURS` (default 72) - maintenance job marks `VENDOR_NO_RESPONSE` without changing `status` (analytics only; client-facing reminders are 1h/6h/24h).
- Admin: `GET /api/v1/admin/marketplace-analytics` → Commerce → Marketplace tab (includes reply-within 1h/6h/24h rates, vendor/client nudge counts, multi-enquire batches).
- Vendor: `GET /api/v1/vendor/analytics` → `/vendor/analytics`.
- Events: `app/features/analytics/events.py` → `marketplace_events` (including `vendor_profile_viewed` on explore vendor detail; `enquiry_vendor_reminded` / `enquiry_client_no_response_nudge` / `enquiry_multi_created` for response-friction iteration).

### Markets, location, and currency (multi-country foundations)

UK is the only **enabled** market at launch. Code must read market config - do not hardcode `GB`, `£`, or `"UK"` in new features.

- **Backend:** `app/features/vendors/markets.py` - `MARKETS`, `get_market()`, `normalize_country_code()`, `default_market()`.
- **Frontend:** `lib/markets.ts` - mirror of backend config; `formatMoney()`, `budgetFilterLabel()`, `marketLocationFallback()`.
- **Vendor payload (JSONB):** `countryCode` (required, default `GB`), `baseCity`, optional `region` / `postalCode`. Denormalized on save via `explore_index.explore_search_patch_from_payload()` → `vendors.country_code`, `vendors.currency`.
- **Vendor onboarding step 3:** country-scoped Photon autocomplete (`lib/photonLocationAutocomplete.ts` → `fetchLocationSuggestions(query, { countryCode })`); radius labels from market distance unit (`mi` vs `km`).
- **Explore search:** `GET /vendors/explore/search?country=GB` (default GB). SQL prefilter on `vendors.country_code`. The **LLM is the only query parser** (`search_ai.parse_marketplace_query`): no regex, synonym map, or canned event checklist. Sanitize only drops unknown taxonomy keys, caps lengths, and collapses duplicate catering needs. **Simple** → one flat exact/related/fallback list. **Plan** (e.g. “help me plan my birthday”) → `plan` checklist + per-need `sections`. Each section has client `why` (LLM `rationale`, else a generic compare sentence), `total_count` = unclaimed pool before the card cap, and vendors may include a real `featured_review` (never invented). Multi-service vendors are claimed by the **first** matching need only so they don’t repeat. If OpenAI is unavailable or parse fails, browse stays up in **token-only simple mode** (whitespace keywords; no types, events, or needs). Response also includes `search_mode`, `intent_summary`. Plan mode ignores URL pagination for sections; “See more” should use a simple type filter (not the plan query) so it stays in simple mode.
- **Browse URL:** optional `country` query param (omitted when GB). Frontend `MarketplaceSearchState.country`.
- **Money columns:** existing `*_gbp` fields remain for UK launch; `currency` column (ISO 4217, default `GBP`) on `vendors` and `booking_requests` for future markets. Use `formatMoney(amount, currency)` in new UI - not raw `£` / `formatGbp`.
- **Adding a market:** enable entry in `MARKETS` (backend + frontend), Stripe Connect country, then expose country picker in vendor onboarding + browse filters.


- **`SupabaseAuthService`** - signup, sign-in, refresh, sign-out.
- **Password reset (app-owned):** `POST /auth/forgot-password` issues a URL-safe token, stores **SHA-256** in `password_reset_tokens` (migration 049), emails a one-click link via Resend Jinja (`auth/password_reset.*`) to `{FRONTEND_URL}/reset-password?token=…` (60 minutes, single use). `POST /auth/reset-password` validates the token, updates password with `auth.admin.update_user_by_id`, sets session cookies. `POST /auth/change-password` (authenticated) verifies the current password then updates. Not Supabase Auth recovery emails. Local auth: logs the reset URL; in-memory tokens.
- **Email verification (app-owned, client/vendor signup):** `POST /auth/signup` creates the account, clears any session, sets `users.email_verified_at` null, issues a hashed token in `email_verification_tokens` (migration 060), and emails `{FRONTEND_URL}/verify-email?token=…` (60m, single use; reuses transactional `auth/password_reset.*` templates). `POST /auth/verify-email` marks verified and sends welcome email. `POST /auth/resend-verification` is enumeration-safe. `POST /auth/signin` rejects unverified client/vendor with a clear message. Existing users are backfilled as verified. Admins are not gated.
- **`/me`:** JWT `user_metadata` / `app_metadata` for `user_type`; **`build_app_user`** enriches from DB; optional **`upsert_user_profile`** after signup. **`users.deleted_at`** (migration **077**): closed accounts stay as tombstones for booking FKs. `require_user` / sign-in reject deleted rows; **`upsert_user_profile` must not restore a tombstone**. Shared booking/chat/review FKs are `ON DELETE RESTRICT` so deleting a user row cannot wipe the other party’s history. Self-serve close: **`POST /api/v1/user/account/deletion`**.
- **Vendor profile** routes often use **`require_user`** so onboarding can start before a `vendors` row exists.
- **Vendor portal gating:** `app/vendor/(portal)/layout.tsx` wraps most routes in **`RequireVendorApproved`**, which uses **`vendorIsLiveApproved`** (`submitted` + `approved` in `frontend/lib/vendorAccess.ts`). **`isVendorPreApprovalRoute`** skips that guard for **`/vendor/profile`**, **`/vendor/contact`**, and **`/vendor/messages`** so pending vendors can finish onboarding, use Contact, and read Eventtz Support threads. Pending nav is Profile / Messages / Contact / Settings; the notification bell footer links pending vendors to **Messages** instead of **Notifications**. `PortalShell` does not fetch bookings until the vendor is live approved.
- **Admin return for edits:** `PATCH /api/v1/admin/vendors/{user_id}/unsubmit` sets `status=draft`, `current_step=8`, and `payload.returnedForEditsAt` (ISO timestamp). Cleared on the next profile **submit** (payload pop before persist). Frontend **`isReturnedForEdits`** is false while `onboarding_status === submitted` (a leftover timestamp must not bounce the wizard 8 ↔ 9). True for draft + timestamp, or legacy draft still parked on the submitted step (`current_step >= 9`). First-time review (draft, step 8, no timestamp) is not “returned”. Copy in `returnedForEditsCopy.ts`. Email uses dual CTAs (Messages + Profile).
- **RLS:** Prefer **`045_enable_rls_all_public_tables.sql`** (RLS on + service-role policies for backend). Older **`009_disable_rls_public_users_vendors.sql`** only if you need a temporary escape hatch while debugging PostgREST; do not leave production on 009-only after 045 is available.

### Error handling from routes

- Success → **`response_model`** instances.
- Failure → **`HTTPException`** with correct status and string **`detail`**; avoid fake “success: false” with HTTP 200 for new APIs.

### Payments (Stripe Connect)

Money is tracked **independently** from the booking request lifecycle:

- **`booking_requests.status`** (`pending`/`accepted`/`declined`/`cancelled`/`completed`) is the request lifecycle - unchanged by payments.
- **`booking_requests.payment_status`** (`unpaid`/`pending`/`paid`/`refunded`/`partially_refunded`/`payout_released`) is the money lifecycle, updated only by `bookings/payments.py` (webhooks, mutual completion, admin dispute actions). `completed` requires `payment_status = 'paid'` (or later).
- **Held-funds model** ("separate charges and transfers"): Checkout charges land in Eventtz's own Stripe balance. Vendor payout is always an explicit `stripe.Transfer`, never automatic Stripe Connect routing - this is what lets a dispute redirect/block funds before the vendor is paid.
- **Vendor payout history** (`GET /api/v1/vendor/payments/history` → `bookings/payout_history.list_vendor_payouts`): shows the vendor's share (`vendor_amount_gbp` / `vendor_portion_gbp`) for `paid` + `payout_released` bookings only - never `total_label` / client total (which includes the Eventtz service fee). Frontend tab: **Payout history** on `/vendor/payments`.
- **Payout trigger:** fully automatic once **both** `client_completion_confirmed_at` and `vendor_completion_confirmed_at` are set (`confirm_completion_for_client`/`confirm_completion_for_vendor` in `bookings/payments.py`) - no admin step in the happy path. Disputes can also trigger a `Transfer` (`release_to_vendor`) or `Refund` (`refund_client`/`partial_refund`) via `admin_ops_service.patch_dispute_case`.
- **48h auto-release (safety net):** if a paid booking's event day has ended and neither party confirmed within `BOOKING_PAYOUT_AUTO_RELEASE_HOURS_AFTER_EVENT` (default 48h, from end of `event_end_date`/`event_date` UTC) and there is **no active dispute**, the payout is released automatically (`payout_auto_released_at`, migration 036). Pure timing/waiting-on rules live in `bookings/completion_rules.py` (no DB/Stripe imports, so `queries.py` can also use them); orchestration lives in `bookings/payments.py`: detail GET (`maybe_auto_release_payout_for_booking`), hourly cron (`process_due_payout_auto_releases` / `send_completion_reminders`), and list/dashboard active GET (`touch_completion_side_effects_for_booking_rows`) which sends **reminders only** - never Stripe Transfers (list rows omit money fields like `vendor_amount_gbp`). `_finalize_completion` always reloads the full booking row before transferring. Batch scans use `event_day_over` (multi-day events wait until `event_end_date` day ends). Booking detail APIs expose `payout_auto_release_at` + `completion_waiting_on`; list APIs include `completion_waiting_on` for dashboard prompts.
- **Cancellation refunds (MVP rule):** anyone cancels before payout → the client gets a **full refund**. `refund_booking_on_cancel` (shared `_refund_paid_booking_row` helper with admin refunds) runs **before** the status flip in `bookings/status.py` - if the Stripe refund fails, the booking stays `accepted`. Cancel is **blocked** when an active dispute exists or `payment_status = payout_released`. Audit columns: `cancelled_by`, `cancelled_at` (migration 036).
- **Booking maintenance:** `app/jobs/run_booking_maintenance.py` - no HTTP endpoint; uses existing `SUPABASE_*` / `STRIPE_*`. Runs post-event completion reminders (`completion_reminder` / `vendor_completion_reminder`, deduped via `completion_reminder_sent_at`) then due payout auto-releases, then marks stale pending client enquiries (`VENDOR_NO_RESPONSE` after `ENQUIRY_RESPONSE_SLA_HOURS`), then enquiry response outreach (`enquiry_reminders.py`: vendor in-app+email at 1h/6h/24h; client “try other vendors” at 24h using `client_search_context`), then one-shot lifecycle reminders (`lifecycle_reminders.py`: event-tomorrow to both parties on paid bookings; client pay-to-confirm 24h after accept if still `unpaid`; vendor payouts-setup email 24h after `approved_at` if Stripe is not ready). The API starts this hourly when `IS_PRODUCTION=true` (`app/jobs/scheduler.py`). Optional CLI: `PYTHONPATH=. python -m app.jobs.run_booking_maintenance`. Apply migrations **075** (`job_runs`) and **076**.
- **Enquiry response friction:** Client create stores optional `client_search_context` (marketplace filters + multi-enquire `batchSize`/`batchIndex`). Immediate vendor notify stays on create; timed vendor reminders + client alternatives are email + in-app only. Public copy uses “Usually replies within …”. Multi-select enquire on marketplace browse loops `POST /client/booking-requests`. Measure via `marketplace_events` (`enquiry_vendor_reminded`, `enquiry_client_no_response_nudge`, `enquiry_multi_created`) and admin marketplace overview reply-within rates / nudge counts.
- **Plain-language money copy:** all client/vendor-facing payment, cancellation, and completion strings are centralised in `frontend/features/bookings/bookingConfirmCopy.ts` (`BOOKING_CONFIRM_COPY`, `PAYMENT_FLOW_COPY`, `completionWaitingCopy`, `autoReleaseLine`) and notification bodies in `notifications/copy.py` - no "payout released"/"escrow" jargon in user-facing surfaces. Post-event UI: `BookingCompletionBanner.tsx` + dashboard attention items.
- **Idempotency:** every Stripe mutation that moves money (`Transfer.create`, `Refund.create`) uses a deterministic `idempotency_key` so webhook redelivery / retries never double-pay. Transfers use `transfer-{booking_id}-{amount_pence}-{destination}` for platform-balance payouts, or `…-src-{charge_id}` when funded from the Checkout charge (`source_transaction`) so a retry after a failed balance attempt gets a fresh key. Reclaim any existing Transfer by `transfer_group=booking_{id}` before creating. Refunds use `refund-{booking_id}-{suffix}`. Checkout `Session.create` deliberately does **not** use one (a stale/expired session could be returned on retry). Ops `admin.payout_stuck` emails are deduped once per booking via `email_delivery_log`.
- **Transfer funding:** completion Transfers pass `source_transaction` = the booking's `stripe_charge_id` (resolved from `stripe_payment_intent_id` when missing) so Stripe funds the vendor payout from the original Checkout charge even when the platform's available balance is zero because automatic payouts already swept it.
- **Stuck payout retry:** if both parties confirmed but `payment_status` is still `paid` (Transfer failed), `confirm-completion` and booking-detail side effects retry `_finalize_completion` instead of no-op'ing.
- **Webhook dedupe:** `stripe_webhook_events` table records processed event ids before handling; state-changing updates additionally use conditional `.eq("payment_status", "<expected>")` writes (optimistic concurrency) so duplicate deliveries are no-ops.
- Vendor Stripe Connect **Express** accounts are created directly via the API (`payments/stripe.create_connect_onboarding_link`) - no OAuth client id. `vendors.stripe_charges_enabled`/`stripe_payouts_enabled` gate whether a vendor can receive a Checkout payment / payout; `approval_status = approved` alone does **not** imply payable **or visible** (see *Marketplace visibility* below).
- **Connect trigger:** not part of vendor profile onboarding. Stripe Connect is launched from the **Payments** page / dashboard banner, the approved-but-hidden onboarding step, or **Accept booking**. Vendor `PATCH …/status` to `accepted` requires both `charges_enabled` and `payouts_enabled`; client Checkout still requires `stripe_account_id` + `charges_enabled`. Both gates are lifted by a `listing_override = 'visible'` admin waiver (see *Marketplace visibility*); the completion `Transfer` never is.

### Marketplace visibility (approval + Stripe + admin override)

**A vendor is publicly listable only when `approval_status = 'approved'` AND (Stripe Connect is verified OR an admin has waived it)** - and never when an admin has force-hidden them. Approval alone is not enough: a vendor who cannot take a charge or receive a payout would strand the client mid-checkout.

- **One source of truth:** `app/features/vendors/visibility.py` - `apply_public_listing_filters(query)` for Supabase queries, `row_is_publicly_listable(row)` for in-memory rows, `vendor_payouts_verified(row)` for the Stripe half alone, `payout_gate_waived(row)` for the admin waiver. **Any new query that exposes vendors publicly must use these** - never re-filter on `approval_status` by hand.
- **Applied in** `vendors/moderation.py`: `list_approved_vendors_for_explore`, `get_approved_vendor_for_explore_by_id`, `get_approved_vendor_payload`, `vendor_is_bookable_for_explore`. Because the last is shared, it also gates client booking create, vendor quote create, and **new chat conversations** (`chat/dm.py`).
- **Self-healing:** the `account.updated` Stripe webhook syncs the flags, so a vendor goes live automatically once Stripe verifies them - no admin action needed.
- **Reads never call Stripe by default.** `get_vendor_profile()` is a database read; only `GET /vendor/profile` opts in with `refresh_payouts=True`, because that screen is where a stale "finish payout setup" is visible. It delegates to `payments/stripe.refresh_pending_connect_flags()`, which no-ops unless the vendor has a Connect account that is not yet fully enabled, and writes fresh flags back to the row - so every other reader (profile save, admin approval, contact) stays on stored values. **Never add Stripe I/O inside a shared row read**: `get_vendor_profile` alone has ~9 call sites, and a save would silently cost two Stripe round trips.
- **Surfaced as:** `listing_visible` + `payouts_verified` on `VendorProfileState` (vendor sees why they're hidden) and `AdminVendorRow` (admin Payouts column / review panel). Index: migration **061**, replaced by **062**.

#### Admin listing override (`vendors.listing_override`, migration 062)

Three states, set from the admin vendor review **Actions** tab via `PATCH /api/v1/admin/vendors/{user_id}/listing-override` → `set_vendor_listing_override()`. A reason is required for anything but `auto` and is written to `admin_audit_logs` plus `listing_override_{reason,by,at}`.

**Hide listing does not touch Stripe Connect columns.** If `stripe_account_id` is missing after a payout, restore via `POST /api/v1/admin/vendors/{user_id}/restore-stripe-connect` (super_admin) which reads the destination from the vendor's latest `booking_requests.stripe_transfer_id`. Application policy: **`_clear_vendor_stripe_connect` never runs for vendors with payout history**; sync soft-fails on `PermissionError` instead of wiping Connect.

| State | Effect |
|-------|--------|
| `auto` (default) | Approval + Stripe decide, as above. |
| `visible` | **Waives the Stripe payout gate end to end**: the vendor is listed, can Accept (`bookings/status._vendor_payouts_ready`), and clients can check out (`payment_checkout`). |
| `hidden` | Never listed, even when fully verified - a takedown that, unlike `banned`, keeps the vendor's portal access. |

- **Why waiving Checkout is safe:** the held-funds model means Checkout collects into Eventtz's own balance and never touches the vendor's Connect account. Only the completion `Transfer` needs it, and `payment_completion.py` already holds the money and notifies the vendor when payouts aren't enabled. So a waived vendor can trade; their payout simply waits.
- **Approval still wins:** a `pending` or `banned` vendor stays hidden whatever the override says.
- **Vendor-facing copy** distinguishes the two hidden reasons: `!listing_visible && !payouts_verified` → "finish payout setup"; `!listing_visible && payouts_verified` → "an admin has paused your listing" (`StepSubmitted`, `useOnboardingPersistence`). Never send a paused vendor to Stripe.

### Vendor list pricing (authoritative for client bookings)

List prices and discounts live in **`vendors.payload`** (onboarding JSON). **Never trust client-supplied `unit_price_gbp`.**

- **Module:** `app/features/vendors/list_pricing.py` - parse packages/rates, main list % discount, bulk/off-peak auto lines. A **complete package** requires `title`, `price`, and `details` (min **40** chars). Incomplete packages are excluded from browse/booking options (no “ask the vendor” fallback).
- **Client booking create:** `POST /api/v1/client/booking-requests` accepts **`selected_option_ids`** + event dates only. `create_booking_request` loads the approved vendor payload, calls `resolve_line_items`, then `compute_automatic_discount_lines`, persists the snapshot, and runs `build_pricing_breakdown`.
- **Vendor quotes** (`create_vendor_quote_booking_request`): vendor-entered line prices remain trusted (vendor-initiated).
- **Discount stacking at create:** (1) main list % on each line → (2) bulk % if subtotal ≥ threshold → (3) off-peak % if `event_date` is in **Nov-Feb** (platform default) → service fee on quoted line items plus any discount adjustments (surcharges excluded).
- **Automatic discount lines:** synthetic negative rows in `line_items` with ids `auto-bulk` / `auto-off-peak`. Not in `selected_option_ids`. Browse UI may preview via `frontend/lib/vendorDiscountDisplay.ts` (`computeBookingEstimateGbp`); stored amounts always come from the server.
- **Explore min price / marketplace cards:** main list discount only (bulk/off-peak are booking-contextual).
- **Checkout refresh:** `app/features/bookings/pricing_refresh.py` - before Stripe Checkout, `reconcile_automatic_discount_lines` recomputes `auto-bulk` / `auto-off-peak` from the current vendor payload + stored `event_date`, persists updated `line_items` + `total_label`, then charges `client_total_gbp`.
- **Stale checkout protection:** webhook/sync finalization rejects sessions whose id ≠ the booking's current `stripe_checkout_session_id`, and verifies Stripe `amount_total` matches session metadata (`client_total_gbp`).
- **Create guard:** reject client bookings when `vendor_portion_gbp <= 0` after breakdown.

### Vendor profile payload validation

On every vendor profile PUT, `normalize_payload_fields` clamps money/discounts, `maxBookingsPerDay` (1-20), and strips non-storage portfolio/doc URLs (`app/features/vendors/payload_validation.py`).

- **Step advance:** when `current_step` increases, `validate_step_fields` runs for the step being completed (location step 3, pricing step 4, availability 5, portfolio 6). Portfolio requires **5-20** images (`MIN_PORTFOLIO_IMAGES` / `MAX_PORTFOLIO_IMAGES` in `payload_validation.py` and `features/vendor/onboarding/constants.ts`).
- **Packages (definition):** one bookable option with **name + price + what's included** (`details`, min 40 chars). Shared rules in `app/features/vendors/package_quality.py` and `frontend/features/vendor/onboarding/packageQuality.ts` (keep in sync). Block vague phrases (`contact for`, `POA`, etc.). **Catering, baking, makeup** require ≥1 complete package before leaving step 4 and on submit. **Profile photo** required on submit.
- **Onboarding UX:** per-step info modals (`onboardingStepGuides.ts`, `OnboardingStepInfoModal.tsx`); category examples on step 4 (`packageExamples.ts`); **AI package coach** `POST /vendor/onboarding/ai/review-packages` (“Help me improve my packages”) handles quality feedback (vague wording, quantities, missing packages, etc.) — suggestions only, never blocks submit. Structural validation (name, price, min description length) stays deterministic in `package_quality.py`.
- **Submit:** when `status` is `submitted` or `complete`, steps 1-8 are validated strictly; `countryCode` defaults to `GB` if missing.
- **Listing photos (admin):** admins drag-reorder profile + portfolio URLs on vendor review (`AdminListingMediaEditor`); first **visible** image is the browse card cover and gallery lead. Hidden URLs are stored in `listingHiddenImageUrls` and omitted from client views. Full admin drag order is stored in `listingDisplayOrder`; vendor `portfolioFileNames` is never rewritten. Public resolution lives in `frontend/lib/vendorPortfolioImages.ts` and `backend/app/features/vendors/listing_media.py`; admin saves via `PATCH /admin/vendors/{id}/listing-media`.
- **Frontend mirror:** `features/vendor/onboarding/vendorOnboardingValidation.ts` + shared limits in `constants.ts` / `packageQuality.ts`.

### Vendor quote & adjustment bounds

- **Quotes:** `validate_quote_line_items` - each line `unit_price_gbp` ≥ £0.01, ≤ £1M; positive vendor portion required (`line_item_validation.py`). Pydantic `BookingLineItemIn` enforces the same range.
- **Adjustments:** `BOOKING_MAX_ADJUSTMENT_GBP` (default **5_000**) per surcharge; sum of positive adjustments capped at `BOOKING_MAX_ADJUSTMENT_PCT_OF_SUBTOTAL` % of line-item subtotal (default **100**, `adjustments.py`).

### Booking calendar capacity

`maxBookingsPerDay` from vendor payload is enforced in `calendar.py` (`_enforce_max_bookings_per_day`) on client and vendor quote booking create - counts overlapping `pending` + `accepted` bookings per calendar day.

**Concurrency:** migration **`033_booking_daily_capacity.sql`** adds a `BEFORE INSERT/UPDATE` trigger with `pg_advisory_xact_lock(vendor, day)` so concurrent creates serialize; the second insert sees the first row and fails if the cap is reached. Python pre-check remains for fast, friendly errors; Postgres is authoritative.

### Admin payment fields

- **Partial refunds:** dispute resolution caps `refund_amount_gbp` to recorded `payment_amount_gbp` for paid bookings (`dispute_ops.py`).
- **Payment patch:** `PATCH /admin/bookings/{id}/payment-fields` - `payment_amount_gbp` is always derived from Stripe `PaymentIntent.amount_received` when a payment intent id is present; client-supplied amounts are ignored (`booking_payment_patch.py`).

### Client chat eligibility

Client-initiated **DM** conversations require `vendor_is_bookable_for_explore` (approved vendor) in `chat/service.py`. Vendor-initiated chat (existing booking relationship) skips this check via `require_bookable_vendor=False`.

### Admin → user support messaging

- One **support** conversation per user (`kind=support`, unique on `support_user_id`).
- Admins compose/search via **`GET /admin/directory/search?q=`** + **`POST /admin/messages/send`**; inbox under **`/admin/messages`**.
- Users see/reply to support threads in the normal **`/chat`** inbox (label “Eventtz Support”); replies bump admin unread + SSE.
- Audit: `chat.admin_send` (and related message actions).

### List filtering (prefer backend)

Search/filter/pagination for directory, disputes, audit, payments, and booking `status=` live on the API - avoid dumping then filtering large lists in the browser. Compose recipient pickers use directory search, not a full client/vendor dump.
---

## Frontend (`frontend/`)

### Stack

- **Next.js (App Router)**, **React**, **TypeScript**, **Tailwind CSS**
- **Fonts:** `next/font` - Fraunces + Plus Jakarta Sans in **`app/layout.tsx`**
- **HTTP:** **`lib/axios.ts`** - `baseURL` from **`NEXT_PUBLIC_API_URL`**, **`withCredentials: true`** (cookie session)
- **`lib/auth-interceptors.ts`** - attaches refresh-on-401 to the shared axios instance (used from **`AuthProvider`**)
- **Icons:** `lucide-react` (and `react-icons` where used, e.g. landing)
- Env: **`frontend/.env.example`**; local **``.env.local`**
- **Mixpanel (browser):** **`lib/mixpanelClient.ts`** + event catalog **`lib/mixpanelEvents.ts`**. Env: **`NEXT_PUBLIC_MIXPANEL_TOKEN`** (no-op when unset); EU projects **must** set **`NEXT_PUBLIC_MIXPANEL_API_HOST=https://api-eu.mixpanel.com`** and restart the Next server. Wired in **`AuthProvider`** (identify / auth events / reset) + **`MixpanelPageViews`**. Product funnel events fire from feature hooks/views after successful API (landing → browse → enquire → pay → complete → review; vendor accept/payouts; admin approve/resolve). Help Center: `help_opened`, `help_article_viewed`, `help_article_feedback`, `help_ask_submitted`, `help_escalated`. First-party SQL aggregates remain in **`marketplace_events`**.
- **Sentry:** `@sentry/nextjs` — shared options in **`lib/sentryConfig.ts`** (`getSentrySharedInitOptions`); thin inits in `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` via `instrumentation.ts`. Env: **`NEXT_PUBLIC_SENTRY_DSN`** (empty = no-op). Errors + tracing; Session Replay sampled low with text/inputs/media masked. `next.config.ts` is wrapped with `withSentryConfig` (existing `/api/v1` rewrites stay). User id (not email) is set from **`AuthProvider`**. No User Feedback widget yet.

### Layering (do not invert)

| Layer | Path | Responsibility |
|--------|------|----------------|
| **Routes** | `app/**/page.tsx`, `layout.tsx` | Thin shells: auth gates, shells, compose one feature view or portal; **no** direct `axios`/`fetch` to API for app data |
| **Features** | `features/<domain>/**` | Screens, hooks, local `*Model.ts` / labels / formatters owned by that flow |
| **Shared UI** | `components/ui/**` | Reusable primitives (Modal, inputs, collapsible, etc.) |
| **Domain badges** | `components/badges/**` | Status badges (booking, payment, vendor, dispute, admin) |
| **Cross-cutting UI** | `components/auth`, `branding`, `*-shell`, `compliances/`, `media/` | Auth context, guards, chrome |
| **Domain wizard** | `features/vendor/onboarding/**` | Multi-step vendor profile (used by **`app/vendor/profile`**) |
| **API & types** | `lib/**` | `*Api.ts` modules, `axios`, `api-errors`, shared TS types |

**Rules**

- **All backend calls** go through **`lib/*`** (typically `*Api.ts`), not from `app/` route files.
- **Tailwind** for styling; match existing spacing/typography patterns. Global purple tokens live in **`globals.css`**: `--primary`, `--primary-soft`, `--primary-muted`, `--primary-border`, `--primary-shadow`, `--accent-gold`, `--accent-violet`, `--page-bg` (with matching utility classes).
- **TypeScript** for new files; landing is split into **`features/landing/*`** (composer + sections + **`landingData.ts`**).
- Vendor JSON profile + uploads: **`vendorProfileApi`**, **`mediaApi`**, onboarding **`serializeVendorPayload`** / **`onboardingLogic`**.

### Frontend maintainability (thin pages, APIs, extracts)

- **Thin `page.tsx`:** route files should be auth/shell + compose one feature view (and `Suspense` if needed). If a page grows past ~50 lines with `useState` / `useEffect` / booking/chat orchestration, extract a **`features/<domain>/…View.tsx`** + hook. Do not call `*Api` from route files.
- **Fat-view extract pattern:** keep the public `*View` export stable for routes; pull state into `use*`, and split large UI into sibling panels/sections under the same feature folder. Prefer extract/move over rewrite.
- **When to split `lib/*Api.ts`:** one domain per module (bookings, dashboard, trust). If a file spans multiple admin console areas (~300+ lines / many unrelated endpoints), split into domain modules and keep a thin re-export facade temporarily so existing imports keep working.
- **`lib` must not import `features/`.** Pure helpers and Zod schemas live in `lib/`; feature-owned UI types stay in `features/`. Product widgets that call APIs (e.g. notification bell) belong in `features/`, not `components/ui/`.
- **Tests:** Vitest (`npm test` in `frontend/`). Prefer pure mappers/hooks over full page mounts.

### Action feedback (mutations)

After a button click or form submit, the user must see **success or failure** within about a second unless the UI change is obviously immediate (e.g. chat bubble appears).

| Situation | Success | Failure |
|-----------|---------|---------|
| **Mutation** (save, send, approve, toggle, delete) | `useToast().showToast({ tone: "success", ... })` | `showToast({ tone: "error", ... })` and/or inline / `AdminErrorBanner` / `LottieFailureInline` |
| **Form validation** | N/A | Inline field error or `LottieFailureInline` |
| **Destructive / money-moving** | Toast plus existing confirm/result modal where present | Modal or toast + inline |
| **Implicit OK** (chat bubble, status badge refresh) | Optional toast for high-stakes actions; failures always surface | Always surface failures |
| **Background / best-effort** (mark notifications read on open) | Silent OK | Silent OK |

Helper: **`lib/mutationFeedback.ts`** (`withMutationFeedback`, `mutationErrorMessage`). Admin persistent success: **`AdminSuccessBanner`**.

**Intentionally implicit (do not add toasts):** chat send (bubble appears), admin inbox reply append, blog `savedHint` inline text.

### Full directory tree (`frontend/`)

```
frontend/
├── app/
│   ├── README.md                  # Route map + route-group primer
│   ├── layout.tsx                 # Root layout, fonts, AuthProvider
│   ├── globals.css                # Brand tokens, prose (compliance + blog), motion
│   ├── (marketing)/               # Public — no URL prefix
│   │   ├── page.tsx               # → LandingMarketplace
│   │   ├── blog/
│   │   └── compliances/
│   ├── (auth)/                    # Shared auth — /login, /register, …
│   ├── api/realtime/stream/       # SSE proxy (cookies → FastAPI)
│   ├── internal/ui-kit/           # Dev-only UI preview (/internal/ui-kit)
│   ├── client/(portal)/           # PortalShell routes
│   ├── vendor/(portal)/
│   └── admin/(portal)/            # AdminShell routes
├── components/
│   ├── README.md                  # Folder map + dependency rules
│   ├── ui/                        # Button, Modal, EmptyState, Loading*, BackLink, …
│   ├── badges/                    # StatusBadge, PaymentStatusBadge, Vendor*Badge, …
│   ├── auth/                      # AuthProvider, Require*, AuthPageShell
│   ├── branding/, compliances/, media/
│   ├── portal-shell/, admin-shell/
│   └── (no product screens here - those live under features/)
├── features/
│   ├── landing/, marketplace/, blog/
│   ├── chat/, bookings/, disputes/, notifications/, settings/, contact/
│   ├── vendors/display/           # Shared vendor listing presentation (browse, marketplace, admin)
│   ├── admin/                     # console views (incl. messages, blog, team)
│   ├── client/                    # auth, browse, bookings, dashboard, payments, onboarding, reviews
│   ├── vendor/                    # auth, dashboard, bookings, quotes, payments, profile, onboarding, analytics
│   └── internal/                  # dev-only (ui-kit preview)
└── lib/                           # *Api.ts, axios, realtime, adminPermissions, …
```

Legacy URLs (`/explore`, `/admin/vendors`, `/client/login`, …) redirect via **`next.config.ts`** — see **`app/README.md`**.

### `app/` routes (what each page composes)

| Route | Typical composition |
|-------|---------------------|
| `/` | `LandingMarketplace` (footer includes **Blog** link) |
| `/explore` | Redirect → `/client/browse` (query preserved) |
| `/blog`, `/blog/[slug]` | `BlogSiteChrome` + `BlogIndexView` / `BlogPostView` |
| `/compliances/*` | `CompliancePageShell` + policy content |
| `/login`, `/register` | `UnifiedLoginView` / `UnifiedRegisterView` |
| `/client/login`, `/client/register` | Redirect → unified auth |
| `/client/dashboard` | `ClientDashboardView` + `PortalShell` (+ onboarding modal when needed) |
| `/client/browse`, `/client/browse/[userId]` | Browse list / `ClientVendorBrowseDetailView` |
| `/client/bookings`, `/client/bookings/[id]` | `ClientBookingsPortal` / booking detail |
| `/client/bookings/[id]/pay` | `ClientBookingPayView` → Stripe via `bookingCheckoutApi` |
| `/client/payments` | `ClientPaymentsView` (API payment_status filters) |
| `/client/messages`, `/client/messages/[id]` | `ChatInboxView` / `ChatThreadView` (DM + support) |
| `/client/notifications` | `NotificationsPageView` |
| `/client/disputes`, `/client/disputes/[id]` | Participant disputes portal |
| `/client/favorites` | Saved vendors (`GET /client/favorites`; explore search `vendor_ids` filter) |
| `/client/planner`, `/client/planner/[planId]` | AI Event Planner dashboard (`AiPlannerView` + `lib/clientPlannerApi.ts`) - one prompt → persisted celebration plan |
| `/client/contact` | `ContactFormView` |
| `/client/settings` | `SettingsView` (+ reviews subsection) |
| `/vendor/login`, `/vendor/register` | Redirect → unified auth |
| `/vendor/dashboard` | `VendorDashboardView` |
| `/vendor/bookings`, `/vendor/bookings/[id]` | Vendor bookings portal / detail |
| `/vendor/onboarding` | Redirect → `/vendor/profile` |
| `/vendor/profile` | `VendorOnboarding` wizard — available before admin approval |
| `/vendor/contact`, `/vendor/messages` | Support form + Eventtz Support threads — available before admin approval (same portal layout exemption as profile) |
| `/vendor/payments` | `VendorPaymentsView` (Stripe Connect) |
| `/vendor/notifications`, `/vendor/disputes`, `/vendor/settings` | Same patterns as client (portal role); require approval except where noted |
| `/admin/login` | Redirect → `/login?next=/admin/dashboard` |
| `/admin` | Redirect → `/admin/dashboard` |
| `/admin/dashboard` | `AdminDashboardView` |
| `/admin/commerce` | Tabs: Bookings / Financials |
| `/admin/directory` | Tabs: Vendors / Clients |
| `/admin/trust` | Tabs: Disputes / Reviews (+ dispute chat panel) |
| `/admin/trust/reviews/[id]` | `AdminReviewDetailView` |
| `/admin/bookings/[id]` | `AdminBookingDetailView` (diagnostics, support-hold, recovery) |
| `/admin/messages` | Tabs: Inbox / Compose (`?tab=inbox` default); nav unread badge |
| `/admin/report-bug` | Staff bug form (`AdminReportBugView`) → `POST /admin/contact` + Cursor webhook |
| `/admin/blog`, `/admin/blog/[id]` | `AdminBlogListView` / `AdminBlogEditorView` (TipTap) |
| `/admin/team` | `AdminTeamView` (`super_admin`) |
| `/admin/audit`, `/admin/audit/[id]` | `AdminAuditView` (+ detail) |
| Legacy `/admin/vendors`, `/admin/disputes`, … | Redirect into portal tab routes (`next.config.ts`) |

*(Exact imports are in each `page.tsx`; keep pages thin.)*

### `lib/` modules

| File | Role |
|------|------|
| **`axios.ts`**, **`api-base.ts`**, **`backend-url.ts`** | Shared HTTP client + base URL |
| **`auth-interceptors.ts`**, **`auth-api.ts`**, **`auth-messages.ts`** | Session refresh, `/me`; **`auth-messages.ts`** is client-only auth UX (API errors come from response `detail`) |
| **`*-messages.ts`** in **`lib/`** | Prefer `getApiErrorDetail` for API copy; local files hold UI-only fallbacks where needed |
| **`validation/`** (`parseForm`, schemas) | Zod form validation (auth, bookings, contact, onboarding, admin, …) |
| **`api-errors.ts`**, **`api-types.ts`**, **`domain-types.ts`** | Error parsing + shared TS types |
| **`vendorProfileApi.ts`**, **`mediaApi.ts`**, **`vendorOnboardingAiApi.ts`** | Vendor profile + uploads (`images`/`files`) + AI |
| **`clientExploreApi.ts`**, **`marketplaceSearchParams.ts`**, **`marketplaceVendorMatch.ts`** | Explore / search |
| **`clientBookingsApi.ts`**, **`vendorBookingsApi.ts`** | Client booking create/list/detail/actions |
| **`vendorPaymentsApi.ts`**, **`bookingCheckoutApi.ts`** | Connect + Checkout |
| **`bookingDisputesApi.ts`**, **`bookingDisputeHelpers.ts`**, **`participantDisputeEnrichment.ts`** | Disputes |
| **`adminVendorsApi.ts`**, **`adminPlatformApi.ts`** (facade re-exporting **`adminDashboardApi.ts`**, **`adminBookingsApi.ts`**, **`adminFinancialsApi.ts`**, **`adminDirectoryApi.ts`**, **`adminTrustApi.ts`**, **`adminAuditApi.ts`**), **`adminTeamApi.ts`**, **`adminMessagesApi.ts`**, **`adminBlogApi.ts`** | Admin console APIs |
| **`adminPermissions.ts`**, **`adminRole.ts`** | `super_admin` / `admin` capability checks |
| **`blogApi.ts`** | Public published posts |
| **`contactApi.ts`** | Contact form submissions (client/vendor + admin bug report) |
| **`helpApi.ts`** | Help Center categories/articles + ask assistant |
| **`clientPlannerApi.ts`** | AI Event Planner create/list/get/replace/archive |
| **`chatApi.ts`** | Conversations + messages (DM + support) |
| **`clientNotificationsApi.ts`**, **`vendorNotificationsApi.ts`**, **`notificationsFeedApi.ts`**, **`bookingNotificationsApi.ts`** | Notification feeds |
| **`clientOnboardingApi.ts`**, **`userSettingsApi.ts`** | Client onboarding + contact sharing |
| **`reviewsApi.ts`**, **`addressApi.ts`**, **`photonLocationAutocomplete.ts`** | Reviews + UK location helpers |
| **`realtimeBus.ts`**, **`realtimeHooks.ts`**, **`useRealtimeSse.ts`**, **`useVisibilityRefresh.ts`** | SSE + tab visibility refresh |
| **`footerLinks.ts`**, **`dateFormat.ts`**, **`bookingServiceFee.ts`**, **`bookingStatusStyles.ts`**, … | Shared constants / formatters |

### `features/` (by area)

| Area | Files / purpose |
|------|------------------|
| **`landing/`** | Marketing composer + sections; footer links to Blog; hero search copy |
| **`marketplace/`** | Explore UI, cards, bookmarks, search model |
| **`blog/`** | Public `BlogSiteChrome`, index + post reading (Fraunces/`font-heading`, `.blog-prose`) |
| **`chat/`** | Inbox/thread/drawer + shared **`MessageComposer`** |
| **`bookings/`** | Pricing breakdown, completion banner, dispute section, confirm copy, **`groupBookingsByEvent`**, **`ActiveEventPrefillBanner`**, **`useActiveEventPrefill`** |
| **`disputes/`** | Participant disputes portal + detail panel |
| **`notifications/`** | Unified notifications page view |
| **`settings/`** | Shared settings sections (account, contact sharing, legal, …) |
| **`contact/`** | `ContactFormView` |
| **`help/`** | `HelpWidget` (FAB for client/vendor/admin) - browse + Ask AI in-panel; admin docs cover console ops. Content from API. |
| **`portal/`** | Shared portal layout helpers |
| **`admin/auth/`**, **`admin/layout/`**, **`admin/components/`** | Login, tabs, metric tiles, table primitives |
| **`admin/dashboard/`**, **`admin/bookings/`**, **`admin/vendors/`**, **`admin/clients/`**, **`admin/financials/`** | Console domain views |
| **`admin/disputes/`**, **`admin/reviews/`**, **`admin/chat/`**, **`admin/audit/`** | Trust + audit |
| **`admin/messages/`** | Support Inbox + Compose |
| **`admin/blog/`** | List + TipTap editor (`BlogRichTextEditor`) |
| **`admin/team/`** | Admin team invite/roles |
| **`client/auth/`**, **`client/browse/`**, **`client/bookings/`**, **`client/dashboard/`** | Client product surfaces |
| **`client/payments/`**, **`client/onboarding/`**, **`client/reviews/`** | Payments list, welcome onboarding modal |
| **`vendor/auth/`**, **`vendor/dashboard/`**, **`vendor/bookings/`**, **`vendor/quotes/`**, **`vendor/payments/`**, **`vendor/profile/`** | Vendor product surfaces |
### `components/` (auth & shells)

- **`AuthProvider`:** holds user state, installs axios interceptors, refresh + `getMe`.
- **`RequireAuth` / `RequireAdmin` / `RequireRole`:** gate routes; redirect to login with `next` query where used.
- **`AdminShell`:** admin layout + nav (Dashboard, Commerce, Directory, Trust, Messages, Report a bug, Blog, Team, Audit); mounts **`HelpWidget`** with `audience="admin"` (Contact → `/admin/report-bug`).
- **`PortalShell`:** client + vendor app chrome (sidebar, `portal="client" | "vendor"`); mounts **`HelpWidget`** (Fern-style in-panel Help Center).
- **`AuthPageShell`:** shared public auth page chrome.
- **TipTap** (`@tiptap/*`): admin blog body editing (`BlogRichTextEditor`, `blogImageExtension` — inline images via drag-and-drop into the editor, optional figure/caption); public blog renders sanitized `body_html` only (cover image is separate `cover_image_url`).

### Conventions (summary)

- **API paths** only in **`lib/*Api.ts`** - match **`/api/v1/...`** backend routes.
- **No raw HTTP in `app/`** for backend resources.
- **Collapsible sections** (e.g. booking details): **`components/ui/CollapsibleSection.tsx`**.
- **Back navigation:** use **`components/ui/BackLink.tsx`** (arrow/chevron + label) instead of ad-hoc `←` text links. Master-detail mobile panes: `mobileOnly` + `tone="muted"`. Auth/compliance shells: `AuthPageShell` / `CompliancePageShell` already include back-to-home.
- **Loading UI:** use **`LoadingSpinner`** (inline/button/input) and **`LoadingState`** (`inline` | `centered` | `page`) from **`components/ui/`** for all data-fetch shells - never bare “Loading…” text. List/detail placeholders: **`SkeletonListRows`** / **`SkeletonDetailHeader`** (include a spinner header). Buttons: **`Button`** `loading` prop. Admin tables/lists: **`AdminLoadingState`**.
- **Buttons:** use **`components/ui/Button.tsx`** for actions; **`ButtonLink`** for navigation CTAs. Shared class logic lives in **`buttonStyles.ts`** (`getButtonClassName`). Variants: `primary` | `secondary` | `ghost` | `destructive`; optional `shape="pill"` for landing/marketplace pills. Do not hand-roll `rounded-full bg-primary px-…` in features.
- **Password fields:** use **`components/ui/PasswordField.tsx`** (show/hide toggle) - never a bare `TextField type="password"`.
- **Hover hints:** use **`components/ui/Tooltip.tsx`** (`hint`, optional `placement` / `widthClassName`). It wraps the trigger rather than sitting inside it, so hints still show on **disabled** buttons, and it opens on keyboard focus. Admin support actions use it via the thin `ActionTooltip` alias. Do not hand-roll `group-hover:block` bubbles. For longer “what / how” explanations behind a help icon, use **`AdminInfoHint`** instead.
- **Form validation:** use **Zod** via **`lib/validation/`** (`parseForm`, shared schemas). Validate in the feature hook/submit handler before API calls; surface `fieldErrors` on inputs and `formError` for banners. Do not rely only on HTML `required`/`minLength`.
- **Cards / surfaces:** canonical tokens in **`components/ui/sectionBlockTokens.ts`**. **Section layout** (gray/page canvas): **`SectionBlock`** + **`SectionHeader`** (large underlined title) + **`ContentCard`** (white inset body) from **`components/ui/SectionBlock.tsx`**. **Standalone panels** (tables, charts): **`PanelCard`** or **`Card`** with `variant="portal"|"admin"`. Portal theme → **`portalTheme.ts`**; admin → **`adminTheme.ts`** (both import shared tokens). Settings sections → **`SettingsSection`**. Nested collapsible panels → **`CollapsibleSection`**. Prefer **`border`** over **`ring`** on full-height / `overflow-hidden` panes. Do not copy ad-hoc card class strings.
- **Colors:** brand tokens in **`globals.css`** (`--primary`, `--page-bg`, `--auth-bg`, etc.) - use `bg-page-bg`, `bg-auth-bg`, `text-neutral-*`, not hardcoded hex (`#f5f2f8`) or `slate-*` / ad-hoc `violet-*` in portal flows. Landing hero nav may use bespoke dark-overlay CTA styles when inverted on imagery.

### Mobile responsiveness

- **Touch targets:** use **`TOUCH_TARGET`** (`min-h-11 min-w-11`) from **`components/ui/tokens.ts`** for icon buttons and primary taps.
- **Motion & Lottie (decision guide for new engineers):**

  | Need | Use |
  |------|-----|
  | Modal / drawer open-close | **`Modal`** / **`Drawer`** only - do **not** wrap content in extra `motion.*` |
  | List/grid entrance | **`MotionStaggerItem`** (`stagger={false}` for chat bubbles) |
  | Landing scroll reveal | **`MotionReveal`** |
  | Empty list / no results | **`EmptyState`** or **`LottieEmptyPanel`** with **`variant`** (`favorites`, `bookings`, `payments`, `vendors`, `messages`, `support`, `team`) - see **`lib/emptyStateVariants.ts`** |
  | Page/panel loading | **`LoadingState`** `branded` or `lottie` |
  | High-stakes confirm | **`ConfirmDialog`** `lottie` prop |
  | Full-page / section error | **`LottieFailurePanel`** |
  | Compact form/fetch error | **`LottieFailureInline`** - never hand-roll `border-red-200` + Lottie |
  | One-off illustration | **`LottieIllustration`** `asset={…}` - size via `className` only (omit to get default) |
  | Onboarding (client/vendor) | Bookends only: **`welcome`** Lottie on first screen, milestone Lottie on finish/submitted; step body uses **`animate-onboarding-panel`** + **`AnimatedStepItem`** stagger. Do **not** put Lottie on every form field |

  **Never** use the **`loading`** asset on empty states - it is a spinner loop and reads as “still loading” next to “no results” copy. **Never** use **`emptyInbox`** / **`emptyMessages`** (mail envelope) as a generic empty illustration - those keys are deprecated; pick a semantic **`variant`** or **`searchNoResults`** for filter misses.

  Asset paths live **only** in **`lib/lottieAssets.ts`**. Prefer shared UI primitives over importing **`motion/react`** in feature folders (allowed only inside `components/ui/*`). Respect **`usePrefersReducedMotion`** (primitives already do).
- **Viewport height:** prefer **`VIEWPORT_MIN`** (`min-h-dvh`) over `min-h-screen` on full-page shells (mobile browser chrome). Marketing landing sections use **`landingSectionClass(..., { shell })`** in **`features/landing/landingSectionStyles.ts`**: **`full`** (hero - `min-h-dvh`), **`near`** (story CTAs - `lg:min-h-dvh`), **`content`** (discover, grids, FAQ - padding only). Prefer `min-h-dvh` over `h-dvh` so tall content can grow.
- **Modals:** use **`MODAL_PANEL`** from tokens; body scroll via **`max-h-[min(70dvh,640px)] overflow-y-auto`** in **`Modal.tsx`**.
- **Flex rows:** add **`min-w-0`** on text children and **`flex-wrap`** on toolbars/filter bars so narrow phones do not overflow.
- **Grids:** default to **`grid-cols-1`** on xs; step up at **`sm:`** / **`md:`**. Admin tables may use **`overflow-x-auto`** or card fallback below **`md`**.
- **Horizontal scrollbars (mobile):** below **`md`**, **`globals.css`** hides horizontal scrollbar tracks app-wide (landing, auth, client/vendor portal, admin). Use **`overflow-x-auto`** when content must scroll sideways; touch/swipe still works - do not add per-component scrollbar-hiding unless you need desktop-only behaviour.
- **Master-detail:** **`MasterDetailLayout`** - one pane at a time below **`lg`** (bookings, messages).

Feature-local **constants, labels, formatters** stay under that feature unless reused across 2+ domains (then consider `lib/`).

Cross-feature data that is not an HTTP client may live next to its owner (e.g. **`browseLabels.ts`** under **`features/client/browse/`**).

---

## Cross-cutting

- **Scope:** Change only what the task requires; avoid drive-by refactors and new files unless they match this layout.
- **Git:** Respect `.gitignore` (e.g. `.env`, `__pycache__`, `.venv`).
- **Docs:** Prefer updating this file or `backend/README.md` when you introduce a **new standard** (e.g. new global middleware), not one-off task notes.

---

## Quick checklist (new backend feature)

1. Pick or create **`app/features/<name>/`** for the product area.
2. Add business logic in **`features/<name>/*.py`**; table access in **`features/<name>/db*.py`**.
3. Add or extend **Pydantic contracts** in **`app/contracts/`**.
4. Add **routes** in **`features/<name>/http/`** - thin handlers (auth → logic → response).
5. Use guards from **`features/auth/http/guards.py`**; register router in **`app/http/router.py`** only.
6. Extend **`config.py` and `backend/.env.example`** if new settings; add **`backend/sql/NNN_*.sql`** if DB changes.

## Quick checklist (new frontend feature)

1. Add or extend **`frontend/lib/<area>Api.ts`** for new endpoints; reuse **`api-errors`** / **`getErrorMessage`** patterns.
2. Put UI and state in **`frontend/features/<domain>/<subfeature>/`** (views, hooks, local types); keep **`app/<route>/page.tsx`** as shell + `Suspense` / auth wrappers only.
3. Reuse **`components/ui/*`**, **`components/auth/*`**, and shell components (`portal-shell`, `admin-shell`) before copying styles.
4. Add **`NEXT_PUBLIC_*`** or document API URL changes in **`frontend/.env.example`** when relevant.

---

## Anti-patterns to avoid

- **Backend:** Putting Supabase queries or business rules inline in HTTP route files; importing `http/` from feature logic modules; mounting routers outside `http/router.py`.
- **Frontend:** Duplicating API paths strings across dozens of files (centralize in `lib/*Api.ts`); growing a single `page.tsx` or one component to thousands of lines; mixing server-only assumptions into client hooks without documenting.

---

*Inventory last reconciled with `backend/app/`, `backend/sql/` (through `082_help_center_kind_tone.sql`), `frontend/app/` (incl. `(marketing)` / `(auth)` / `(portal)` route groups), `frontend/features/`, and `frontend/lib/`. Update the matching tables when you add routes, features, or API modules.*
