# Eventtz Engineering Course — Progress

Personal engineering course using the real Eventtz codebase.

**Course branch:** `cursor/engineering-course-28c8`  
**Primary track:** [FEATURE_TRACK.md](./FEATURE_TRACK.md)  
**Entry point:** [README.md](./README.md)

### Learner preferences

- **Models over SQL** — teach via `contracts/`, `domain-types.ts`, and feature code; SQL only when asked or for migrations.
- **Complete route** — every example lists the full file path chain (UI → API → contract → feature → `get_db()`) before showing code snippets.
- **Descriptive names** — immediately understandable; use full words, not abbreviations like `pb` or `row0`.
- **Skip mandatory tasks** — teacher-led feature walkthroughs; no hunts/exit tickets unless requested.
- **Primary track:** [FEATURE_TRACK.md](./FEATURE_TRACK.md) (auth → booking → payment → payout).

---

## Re-sync log

| Date | Action |
|------|--------|
| 2026-08-31 | Merged `main` into course branch — synced lessons **6**, **7a–7c** (payout readiness API, booking list order, detail header UX, referrals settings rewrite) |
| 2026-08-30 | Merged `main` (`2b42850`) into `cursor/engineering-course-28c8` — 99 commits of product changes |
| 2026-08-30 | Re-synced lessons **1–3b** to match current code (browse hooks, submit hook, controller split, status modules, Sentry, deleted accounts) |
| 2026-08-30 | Wrote full lessons **4–7c** (+ payment and vendor booking walkthroughs) |

**Major deltas since Aug-2026 lesson baseline:**

- Payout readiness: `can_accept_bookings` + `payout_gate_waived` on `GET /vendor/payments/status`; `isVendorPayoutsReady` mirrors `vendor_connect_can_receive_payouts`
- Booking list/detail: `bookingListOrder.ts` (`updated_at` first); `BookingDetailPanel` ref + copy; dispute `presentation="header"`
- Vendor referrals settings: tier table, one-time code (`REFERRAL_CODE_LOCKED`), historical **Code used** column; `booking_discount.py` two-phase model; shared `bookingServiceFee.ts` tiers
- Browse: `useMarketplaceExplore`, `useBrowseGeolocation`, filter component split
- Booking enquire: `useVendorBookingSubmit`, per-unit `quantities`, vendor client referrals (`?vref=`), service fee breakdown
- Booking detail: `useClientBookingActions`, `useClientBookingPaymentReturn`, `status_client.py` / `status_vendor.py`
- Auth: Sentry identify, 503 on Supabase timeout, `deleted_at` tombstones
- Payments: receipt snapshots, held-funds finalize
- Vendor: tiered client referrals in Settings, S3 media uploads
- Launch: `BOOKINGS_LAUNCHING_SOON` is now **`false`** (booking enabled for all clients)

---

## Feature track progress

| Slice | Teaching | Lesson doc |
|-------|----------|------------|
| 1 Authentication | **complete** | written + synced |
| 2 Client browse | **complete** | written + synced |
| 3a Client booking — enquire | **complete** | written + synced |
| 3b Client booking — detail | **complete** | written + synced |
| 4 Client payment | not started | **written** |
| 5 Vendor booking lifecycle | not started | **written** |
| 6 Payout + completion | not started | **written** |
| 7a Client workspace | not started | **written** |
| 7b Comms + realtime | not started | **written** |
| 7c Trust + vendor + admin | not started | **written** |

---

## Slice 1 — Authentication (feature track)

**Date completed:** 2026-08-16  
**Lesson synced:** 2026-08-30  
**Lesson:** `docs/engineering/lessons/slice-1-auth-me.md`

### Covered

| Area | Topics |
|------|--------|
| Session | Cookie tokens, `GET /me`, refresh interceptor on 401 |
| Sign-in | `UnifiedLoginView` → `POST /signin` → `build_app_user` → `resolvePostAuthPath` |
| Role / UI | `user_type` from `/me`; portal layouts; `PortalShell` |
| Guards | `RequireAuth` / `RequireRole` (frontend); `require_user`, `require_client`, etc. (backend) |
| Sign-up | `POST /signup`, email verification gate, vendor `referral_code` (partner referrals) |
| Sign-out | `POST /signout`, cookie clear, Mixpanel + Sentry reset |
| Passwords | Forgot → reset → sign-in; change-password revokes sessions |
| **New (sync)** | Sentry `identifySentryUser`; auth 503 on Supabase timeout; `deleted_at` tombstones in `require_user` |

### Key files (bookmark)

- `frontend/components/auth/AuthProvider.tsx`, `frontend/lib/sentryUser.ts`
- `frontend/lib/auth-api.ts`, `frontend/features/auth/authRouting.ts`
- `backend/app/contracts/auth.py`
- `backend/app/features/auth/http/routes.py`, `guards.py`, `session.py`, `accounts.py`

---

## Slice 2 — Client browse (feature track)

**Date completed:** 2026-08-16  
**Lesson synced:** 2026-08-30  
**Lesson:** `docs/engineering/lessons/slice-2-client-browse.md` + walkthrough

### Covered

| Area | Topics |
|------|--------|
| URLs | `/client/browse`, `/client/browse/[userId]`, `/explore` redirect |
| Layout | `ClientBrowsePortalLayout` — guests public chrome; clients `PortalShell` |
| List UI | `MarketplaceExploreView` + **`useMarketplaceExplore`** hook |
| Geolocation | **`useBrowseGeolocation`** — proximity sort via browser location |
| Filters | `MarketplaceFiltersBar`, category/date filter field components |
| Detail UI | `ClientVendorBrowseDetailView`, `useExploreVendor` |
| API | `GET /vendors/explore/search`, `GET /vendors/explore/vendor/{id}` |
| Listing rules | `visibility.py` + `moderation.py`; **`deleted_user_ids`** exclusion |
| Query parse | `search_ai.py` — plan mode vs simple search |

### Key files (bookmark)

- `frontend/features/marketplace/useMarketplaceExplore.ts`, `useBrowseGeolocation.ts`
- `frontend/features/marketplace/MarketplaceFiltersBar.tsx`
- `frontend/lib/clientExploreApi.ts`, `frontend/lib/marketplaceSearchParams.ts`
- `backend/app/features/vendors/search.py`, `search_ai.py`, `visibility.py`

---

## Slice 3a — Client booking: enquire (feature track)

**Date completed:** 2026-08-16  
**Lesson synced:** 2026-08-30  
**Lesson:** `docs/engineering/lessons/slice-3a-client-booking-enquire.md` + walkthrough

### Covered

| Area | Topics |
|------|--------|
| Entry UI | `VendorBookingModal`, `MultiVendorEnquireModal` |
| Submit hook | **`useVendorBookingSubmit`** (extracted from modal) |
| Per-unit pricing | `QuantityStepper`, `quantities` on create, `packagePricing.ts` |
| Referrals | **`useVendorReferralPreview`**, `?vref=`, `vendor_referral_code` on row |
| Service fee | `ClientFeeBreakdownSummary`, `service_fee_percent` snapshot |
| Snapshot | `resolve_line_items` — prices from vendor profile at submit |
| Launch gate | `BOOKINGS_LAUNCHING_SOON` (currently **false**) + early-access list |
| After submit | Redirect `/client/bookings/{id}` |

### Key files (bookmark)

- `frontend/features/client/browse/useVendorBookingSubmit.ts`, `useVendorReferralPreview.ts`
- `frontend/features/client/browse/vendorBrowseDetailModel.ts`, `VendorBookingModal.tsx`
- `frontend/lib/clientBookingsApi.ts`, `frontend/features/bookings/bookingConfirmCopy.ts`
- `backend/app/features/bookings/create.py`, `vendor_referrals/validate.py`

---

## Slice 3b — Client booking: detail (feature track)

**Date completed:** 2026-08-16  
**Lesson synced:** 2026-08-30  
**Lesson:** `docs/engineering/lessons/slice-3b-client-booking-detail.md` + walkthrough

### Covered

| Area | Topics |
|------|--------|
| URLs | `/client/bookings`, `/client/bookings/[id]` master–detail |
| Controller split | `useClientBookingsController` orchestrates **`useClientBookingActions`** + **`useClientBookingPaymentReturn`** |
| Two lifecycles | `booking_status` vs `payment_status` |
| Status backend | **`status_client.py`**, **`status_vendor.py`**, **`status_shared.py`** |
| Adjustments | Vendor `PUT .../adjustments`; client accept/decline via `PATCH .../status` |
| Pricing display | Service fee + referral discount fields on detail contract |

### Key files (bookmark)

- `frontend/features/client/bookings/useClientBookingsController.ts`
- `frontend/features/client/bookings/useClientBookingActions.ts`, `useClientBookingPaymentReturn.ts`
- `frontend/features/bookings/BookingDetailPanel.tsx`, `BookingPriceUpdateBanner.tsx`
- `backend/app/features/bookings/status_client.py`, `adjustments.py`, `pricing_confirmation.py`

---

## Slice 4 — Client payment (feature track)

**Status:** lesson written — teaching not started  
**Lesson:** [lessons/slice-4-client-payment.md](./lessons/slice-4-client-payment.md) + [walkthrough](./lessons/slice-4-payment-flow-walkthrough.md)

### Lesson covers

| Area | Topics |
|------|--------|
| Trigger | Payment-due banner, `useClientBookingPaymentReturn` on `?payment=success` |
| Pay flow | `ClientBookingPayView`, `useClientBookingPay`, `PaymentSafetyModal` |
| API | `postBookingCheckout`, `postBookingCheckoutSync` |
| Backend | `payment_checkout.py`, `payment_finalize.py`, receipt snapshots |
| Webhook | `payments/http/webhooks.py` — idempotent finalize |
| History | `/client/payments` — `ClientPaymentsView` |

---

## Slice 5 — Vendor booking lifecycle (feature track)

**Status:** lesson written — teaching not started  
**Lesson:** [lessons/slice-5-vendor-booking.md](./lessons/slice-5-vendor-booking.md) + [walkthrough](./lessons/slice-5-vendor-booking-walkthrough.md)

### Lesson covers

| Area | Topics |
|------|--------|
| Portal | `VendorBookingsView`, `useVendorBookingsController`, `vendorBookingViewModel` |
| Response | Accept/decline, adjustments, withdraw quote |
| Chat quote | `VendorQuoteFormModal` → `create_vendor_quote_booking_request` |
| Payout gate | `useVendorPayoutsReady` before vendor accept |
| Backend | `status_vendor.py`, `adjustments.py` |

---

## Slice 6 — Payout, completion, refunds (feature track)

**Status:** lesson written — teaching not started  
**Lesson:** [lessons/slice-6-vendor-payout.md](./lessons/slice-6-vendor-payout.md)

### Lesson covers

| Area | Topics |
|------|--------|
| Connect | Stripe Connect onboarding at `/vendor/payments` |
| Completion | Dual confirmation banners → Stripe Transfer |
| Maintenance | Auto-release job, `payment_maintenance.py` |
| Refunds | Paid cancel → `payment_refunds.py` |
| Hold | Payout held when Connect incomplete (migration 078) |

---

## Slice 7a — Client workspace (feature track)

**Status:** lesson written — teaching not started  
**Lesson:** [lessons/slice-7a-client-workspace.md](./lessons/slice-7a-client-workspace.md)

### Lesson covers

Dashboard attention feed, AI planner, `client_events` glue, favorites, planner → enquire handoff via `useActiveEventPrefill`.

---

## Slice 7b — Comms + realtime (feature track)

**Status:** lesson written — teaching not started  
**Lesson:** [lessons/slice-7b-comms-realtime.md](./lessons/slice-7b-comms-realtime.md)

### Lesson covers

SSE (`useRealtimeSse`), notifications bell + feed, chat, contact forms, transactional email dispatch.

---

## Slice 7c — Trust, vendor onboarding & admin (feature track)

**Status:** lesson written — teaching not started  
**Lesson:** [lessons/slice-7c-trust-and-admin.md](./lessons/slice-7c-trust-and-admin.md)

### Lesson covers

Vendor onboarding + S3 media, tiered vendor client referrals (Settings), reviews, disputes, admin console (directory, commerce, trust, referrals, blog). Partner signup referrals cross-ref Slice 1.
