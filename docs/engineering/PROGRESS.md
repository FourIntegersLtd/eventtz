# Eventtz Engineering Course — Progress

Personal engineering course using the real Eventtz codebase.

**Course branch:** `cursor/engineering-course-28c8`  
**Primary track:** [FEATURE_TRACK.md](./FEATURE_TRACK.md)  
**Entry point:** [README.md](./README.md)

### Learner preferences

- **Models over SQL** — teach via `contracts/`, `domain-types.ts`, and feature code; SQL only when asked or for migrations.
- **Complete route** — every example lists the full file path chain (UI → API → contract → feature → `get_db()`) before showing code snippets.
- **Descriptive names** — immediately understandable; see [NAMING.md](./NAMING.md).
- **Skip mandatory tasks** — teacher-led feature walkthroughs; no hunts/exit tickets unless requested.
- **Primary track:** [FEATURE_TRACK.md](./FEATURE_TRACK.md) (auth → booking → payment → payout).

---

## Feature track progress

| Slice | Status |
|-------|--------|
| 1 Authentication | **complete** |
| 2 Client browse | **complete** |
| 3a Client booking — enquire | **complete** |
| 3b Client booking — detail | **complete** |
| 4 Client payment | not started |
| 5 Vendor booking lifecycle | not started |
| 6 Payout + completion | not started |
| 7a Client workspace | not started |
| 7b Comms + realtime | not started |
| 7c Trust + vendor + admin | not started |

---

## Slice 1 — Authentication (feature track)

**Date completed:** 2026-08-16  
**Code base:** merged `main` through app-folder restructure (`(auth)/`, `(marketing)/`, `(portal)/`), `backend/app/contracts/auth.py`, Supabase-only auth (no local store).

### Covered

| Area | Topics |
|------|--------|
| Session | Cookie tokens (`eventtz_access_token` / `eventtz_refresh_token`), `GET /me`, refresh interceptor on 401 |
| Sign-in | `UnifiedLoginView` → `POST /signin` → `build_app_user` → `resolvePostAuthPath` |
| Role / UI | `user_type` from `/me`; layouts under `client/(portal)/`, `vendor/(portal)/`, `admin/(portal)/`; `PortalShell portal=` for nav |
| Guards | `RequireAuth` / `RequireRole` (frontend); `require_user`, `require_client`, etc. (backend) |
| Sign-up | `POST /signup`, `session: null`, `user_type` + optional `referral_code` (vendor) |
| Email verify | `issue_email_verification` → `/verify-email?token=` → `email_verified_at`; sign-in blocked until verified |
| Referral | `?ref=` / cookie → `referralSlug` → `referral_code` on vendor signup → `referral_attributions` |
| Sign-out | `POST /signout`, `clear_session_cookies`, `AuthProvider` clears `user` |
| Passwords | Forgot (enumeration-safe) → reset link → `POST /reset-password` signs in; change-password revokes sessions |
| Admin auth | Unified `/login` (`/admin/login` redirects via `next.config.ts`); `?next=/admin/dashboard` |

### Key files (bookmark)

- `frontend/app/README.md` — URL → folder map
- `frontend/app/(auth)/` — login, register, verify-email, forgot/reset password
- `frontend/components/auth/AuthProvider.tsx`
- `frontend/lib/auth-api.ts`, `frontend/features/auth/authRouting.ts`
- `backend/app/contracts/auth.py`
- `backend/app/features/auth/http/routes.py`, `guards.py`, `session.py`, `accounts.py`
- `backend/app/features/auth/email_verification.py`, `password_reset.py`, `messages.py`

### Lesson status

**Complete** — see `lessons/slice-1-auth-me.md`.

---

## Slice 2 — Client browse (feature track)

**Date completed:** 2026-08-16  
**Lesson:** `docs/engineering/lessons/slice-2-client-browse.md`

### Covered

| Area | Topics |
|------|--------|
| URLs | `/client/browse`, `/client/browse/[userId]`, `/explore` → browse redirect |
| Layout | `ClientBrowsePortalLayout` — guests public chrome; clients `PortalShell` |
| List UI | `MarketplaceExploreView`, URL search params, `fetchExploreVendorsSearch` |
| Detail UI | `ClientVendorBrowseDetailView`, `useExploreVendor`, `VendorBrowseDetailBody` |
| API | Public `GET /vendors/explore/search`, `GET /vendors/explore/vendor/{id}` (no auth guards) |
| Listing rules | `apply_public_listing_filters` — approved + Stripe ready or admin `visible`, not `hidden` |
| Models | `ExploreVendorRow`, `ExploreVendorSearchRow` in contracts + `clientExploreApi.ts` |
| Metrics | Review stats + `public_metrics` merged on explore responses |
| Query parse | `search_ai.py` — LLM-only `parse_marketplace_query`; token-only keywords fallback when OpenAI down |

### Key files (bookmark)

- `frontend/app/client/(portal)/browse/`
- `frontend/features/marketplace/MarketplaceExploreView.tsx`
- `frontend/features/client/browse/`
- `frontend/lib/clientExploreApi.ts`, `frontend/lib/marketplaceSearchParams.ts`
- `backend/app/features/vendors/http/explore.py`
- `backend/app/features/vendors/moderation.py`, `visibility.py`, `search.py`, `search_ai.py`
- `backend/app/contracts/vendor.py`

### Lesson status

**Complete** — ready for Slice 3a (Client booking — enquire).

---

## Slice 3a — Client booking: enquire (feature track)

**Date completed:** 2026-08-16  
**Lesson:** `docs/engineering/lessons/slice-3a-client-booking-enquire.md`

### Covered

| Area | Topics |
|------|--------|
| Entry UI | `VendorBookingModal` (single vendor), `MultiVendorEnquireModal` (browse multi-select) |
| Auth | Client-only enquire; `require_client` on POST; guests see login |
| API | `POST /api/v1/client/booking-requests` |
| Snapshot | `resolve_line_items` — prices from vendor profile at submit, stored in `line_items` JSON |
| Payload | Client sends `selected_option_ids` only — no prices from browser |
| Create flow | `create_booking_request` — calendar, pricing, insert, chat notes, notifications |
| Status | `pending`, `initiator: client`, payment `unpaid` |
| After submit | Toast + redirect `/client/bookings/{id}` |

### Key files (bookmark)

- `frontend/features/client/browse/ClientVendorBrowseDetailView.tsx`
- `frontend/features/client/browse/VendorBookingModal.tsx`
- `frontend/features/marketplace/MultiVendorEnquireModal.tsx`
- `frontend/lib/clientBookingsApi.ts`, `frontend/lib/validation/bookings.ts`
- `backend/app/features/bookings/http/client.py`
- `backend/app/features/bookings/create.py`
- `backend/app/features/vendors/list_pricing.py` — `resolve_line_items`
- `backend/app/contracts/booking.py` — `CreateBookingRequestBody`

### Lesson status

**Complete** — ready for Slice 3b (booking detail, status, adjustments).

---

## Slice 3b — Client booking: detail, status, adjustments (feature track)

**Date completed:** 2026-08-16  
**Lesson:** `docs/engineering/lessons/slice-3b-client-booking-detail.md`

### Covered

| Area | Topics |
|------|--------|
| URLs | `/client/bookings`, `/client/bookings/[id]` master–detail |
| Detail load | `fetchClientBookingDetail` → `GET /client/booking-requests/{id}` |
| Two lifecycles | `booking_status` (agreement) vs `payment_status` (money) |
| Shared UI | `BookingDetailPanel`, `useParticipantBookingsScaffold` (client + vendor) |
| Initiator | `client` enquiry vs `vendor` quote — different pending actions |
| Adjustments | Vendor `PUT .../adjustments`; client reads + confirms via `PATCH .../status` |
| Price update | `BookingPriceUpdateBanner`; decline reverts to original snapshot price |
| Cancel | `POST .../cancel` while pending/accepted |
| Banners | Payment due (`accepted` + unpaid), completion, checkout return (adjacent Slice 4) |

### Key files (bookmark)

- `frontend/app/client/(portal)/bookings/`
- `frontend/features/client/bookings/useClientBookingsController.ts`
- `frontend/features/client/bookings/ClientBookingDetailExtras.tsx`
- `frontend/features/bookings/BookingDetailPanel.tsx`
- `frontend/features/bookings/BookingPriceUpdateBanner.tsx`
- `frontend/lib/clientBookingsApi.ts`
- `backend/app/features/bookings/http/client.py`
- `backend/app/features/bookings/queries.py`
- `backend/app/features/bookings/status.py`
- `backend/app/features/bookings/adjustments.py`
- `backend/app/features/bookings/pricing_confirmation.py`
- `backend/app/contracts/booking.py` — `ClientBookingDetail`, `ClientBookingStatusBody`

### Lesson status

**Complete** — ready for Slice 4 (client payment / Stripe Checkout).

---

## Slice 4 — Client payment (feature track)

**Status:** not started  
**Outline:** [lessons/slice-4-client-payment.md](./lessons/slice-4-client-payment.md)

---

## Slice 5 — Vendor booking lifecycle (feature track)

**Status:** not started  
**Outline:** [lessons/slice-5-vendor-booking.md](./lessons/slice-5-vendor-booking.md)

---

## Slice 6 — Payout, completion, refunds (feature track)

**Status:** not started  
**Outline:** [lessons/slice-6-vendor-payout.md](./lessons/slice-6-vendor-payout.md)

---

## Slice 7a — Client workspace (feature track)

**Status:** not started  
**Outline:** [lessons/slice-7a-client-workspace.md](./lessons/slice-7a-client-workspace.md)

---

## Slice 7b — Comms + realtime (feature track)

**Status:** not started  
**Outline:** [lessons/slice-7b-comms-realtime.md](./lessons/slice-7b-comms-realtime.md)

---

## Slice 7c — Trust, vendor onboarding & admin (feature track)

**Status:** not started  
**Outline:** [lessons/slice-7c-trust-and-admin.md](./lessons/slice-7c-trust-and-admin.md)
