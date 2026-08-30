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

| # | Slice | Status | Lesson |
|---|-------|--------|--------|
| 1 | **Authentication** — login, session, `/me`, guards, signup, verify, passwords | **complete** | [slice-1-auth-me.md](./lessons/slice-1-auth-me.md) |
| 2 | **Client browse** — explore, vendor profile (read-only) | **complete** | [slice-2-client-browse.md](./lessons/slice-2-client-browse.md) |
| 3a | **Client booking — enquire** | **complete** | [slice-3a-client-booking-enquire.md](./lessons/slice-3a-client-booking-enquire.md) |
| 3b | **Client booking — detail, status, adjustments** | **complete** | [slice-3b-client-booking-detail.md](./lessons/slice-3b-client-booking-detail.md) |
| 4 | **Client payment** — Checkout, sync, webhook | **lesson written** | [slice-4-client-payment.md](./lessons/slice-4-client-payment.md) |
| 5 | **Vendor booking lifecycle** — quotes, accept, adjustments | **lesson written** | [slice-5-vendor-booking.md](./lessons/slice-5-vendor-booking.md) |
| 6 | **Payout, completion, refunds** — Stripe Connect | **lesson written** | [slice-6-vendor-payout.md](./lessons/slice-6-vendor-payout.md) |
| 7a | **Client workspace** — dashboard, planner, events, favorites | **lesson written** | [slice-7a-client-workspace.md](./lessons/slice-7a-client-workspace.md) |
| 7b | **Comms + realtime** — chat, notifications, email, contact | **lesson written** | [slice-7b-comms-realtime.md](./lessons/slice-7b-comms-realtime.md) |
| 7c | **Trust & ops** — vendor onboarding, reviews, disputes, admin | **lesson written** | [slice-7c-trust-and-admin.md](./lessons/slice-7c-trust-and-admin.md) |

**Slice 7** is three lessons (7a / 7b / 7c). Together with slices 1–6, they cover every major product area.

---

## Feature coverage matrix

| Product area | Primary URLs | Slice |
|--------------|-------------|-------|
| Auth | `/login`, `/register`, `/verify-email` | **1** |
| Marketing landing | `/` | ref in **2** |
| Client browse + vendor profile (read) | `/client/browse`, `/client/browse/[id]` | **2** |
| Browse geolocation sort | `useBrowseGeolocation`, search `lat`/`lng` | **2** |
| Client booking enquire | browse → modal → POST | **3a** |
| Per-unit package quantities | `QuantityStepper`, `quantities` on create | **3a** |
| Vendor client referral at enquire | `?vref=`, `vendor_referral_code` | **3a** (+ settings **7c**) |
| Service fee on booking | `ClientFeeBreakdownSummary`, `service_fee_percent` | **3a**, **3b**, **4** |
| Client booking detail | `/client/bookings/[id]` | **3b** |
| Client payment | `/client/bookings/[id]/pay`, `/client/payments` | **4** |
| Payment receipts | receipt snapshots after finalize | **4** |
| Vendor bookings portal | `/vendor/bookings` | **5** |
| Vendor quote from chat | messages → quote modal | **5** |
| Vendor accept/decline + adjustments | vendor booking detail | **5** |
| Stripe Connect + payout | `/vendor/payments` | **6** |
| Dual completion + auto-release | booking detail banners | **6** |
| Cancel + refund (paid) | cancel on detail | **6** |
| Client dashboard | `/client/dashboard` | **7a** |
| AI planner + events | `/client/planner` | **7a** |
| Favorites | `/client/favorites` | **7a** |
| Chat / messages | `/client/messages`, `/vendor/messages` | **7b** |
| Notifications | bell, `/notifications` | **7b** |
| Transactional email | server dispatch | **7b** |
| Contact support | `/client/contact`, `/vendor/contact` | **7b** |
| Realtime SSE | `useRealtimeSse` | **7b** |
| Vendor profile / onboarding | `/vendor/profile` | **7c** |
| Reviews | booking detail, `/vendor/profile/reviews` | **7c** |
| Disputes | `/disputes`, admin trust | **7c** |
| Admin console | `/admin/*` | **7c** |
| Referrals (admin partners) | `/admin/referrals` | **7c** (signup attribution in **1**) |
| Vendor client referrals (tiered) | Settings → referrals, `?vref=` on browse | **3a**, **7c** |
| S3 media uploads | vendor onboarding portfolio | **7c** |
| Blog | `/blog`, `/admin/blog` | **7c** |

**Out of scope:** `/internal/ui-kit`, help content pages, geo autocomplete helpers.

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

## Slice 4 — Client payment

### User story

A client with an **accepted + unpaid** booking pays via Stripe Checkout; payment is finalized by webhook (with sync fallback on return).

### Complete route

**Frontend:** `useClientBookingsController.ts` → `ClientBookingDetailExtras.tsx` → `[bookingId]/pay/page.tsx` → `ClientBookingPayView.tsx` → `useClientBookingPay.ts` → `PaymentSafetyModal.tsx` → `bookingCheckoutApi.ts` → `clientBookingsApi.ts` (venue patch)

**Backend:** `bookings/http/client.py` (checkout + sync) → `contracts/payments.py` → `payment_checkout.py` → `payment_finalize.py` → `payments/http/webhooks.py` → `payments/stripe.py` → `core/db.py`

### Key concepts

- Held-funds model (platform balance first; vendor Transfer in slice 6)
- Server recomputes pricing before Checkout
- `payment_status`: `unpaid` → `pending` → `paid`
- Webhook idempotency + sync fallback

### If something broke

| Symptom | First file |
|---------|------------|
| Pay button missing | `useClientBookingsController.ts` |
| Checkout 400 | `payment_checkout.py` |
| Stuck on pending | `payment_finalize.py` |
| Return URL no update | `postBookingCheckoutSync` in controller |

---

## Slice 5 — Vendor booking lifecycle

### User story

A vendor manages booking requests: accepts/declines client enquiries, sends quotes from chat, suggests price adjustments, and withdraws their own quotes.

### Complete route

**Vendor portal:** `vendor/bookings/` pages → `VendorBookingsView` → `useVendorBookingsController` → `VendorBookingResponseFlow` → `VendorBookingResponseAdjustments` → `useParticipantBookingsScaffold`

**Quote from chat:** `ChatThreadView` → `VendorQuoteFormModal`

**Payout gate:** `useVendorPayoutsReady` → `PayoutSetupRequiredModal`

**Backend:** `vendorBookingsApi.ts` → `bookings/http/vendor.py` → `create.py` (vendor quote) → `status.py` → `adjustments.py` → `pricing_confirmation.py`

### Key concepts

- `initiator` flips who accepts while `pending`
- Vendor adjustments write path (client confirm in 3b)
- Payout readiness gate before vendor accept

### If something broke

| Symptom | First file |
|---------|------------|
| Accept blocked | `status.py` + `useVendorPayoutsReady` |
| Quote won't send | `VendorQuoteFormModal.tsx` → `create.py` |
| Adjustment caps | `adjustments.py` |

---

## Slice 6 — Payout, completion, refunds

### User story

A vendor completes Stripe Connect, both parties confirm event completion (or auto-release fires), funds transfer to the vendor; paid cancellations refund the client.

### Complete route

**Connect:** `vendor/payments/page.tsx` → `VendorPaymentsView` → `vendorPaymentsApi.ts` → `payments/http/vendor.py` → `stripe.py`

**Completion:** `BookingCompletionBanner` → `clientBookingsApi` / `vendorBookingsApi` confirm → `payment_completion.py` → `completion_rules.py`

**Maintenance:** `payment_maintenance.py` → `run_booking_maintenance.py`

**Refunds:** `status.py` cancel → `payment_refunds.py`

### Key concepts

- Connect ≠ vendor profile onboarding
- Dual completion → Stripe Transfer
- Auto-release after event
- Refund-before-cancel

---

## Slice 7a — Client workspace

### User story

A signed-in client uses dashboard, AI planner, linked celebration events, and saved favorites.

### Complete route

`client/dashboard` → `client/planner` → `clientPlannerApi.ts` → `planner/` + `client_events/` → `client/favorites` → `favorites/http/client.py` → `useActiveEventPrefill.ts`

### Key concepts

- `client_events` as glue (no dedicated events page)
- Planner handoff into enquire (3a)

---

## Slice 7b — Comms + realtime

### User story

Clients and vendors message, get notifications and emails, contact support, and see live SSE updates.

### Complete route

`useRealtimeSse.ts` → `realtime/sse.py` → notifications UI + `notifications/` → chat pages + `chat/` → `contact/` → trace `email/dispatch.py`

### Key concepts

- SSE refresh without full reload
- Chat tied to `conversation_id` on bookings

---

## Slice 7c — Trust, vendor onboarding & admin

### User story

Vendors onboard; clients review; participants dispute; admins run the platform.

### Complete route

`vendor/profile` onboarding → reviews → disputes → admin dashboard → directory → commerce → trust → referrals → blog

### Key concepts

- Vendor approval gates explore (slice 2)
- Reviews post-`completed`
- Disputes can hold payout (slice 6)

---

## Learner preferences

- Models over SQL
- Complete routes always
- Descriptive names
- **No mandatory tasks**
