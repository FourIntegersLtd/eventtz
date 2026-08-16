# Eventtz codebase map (for tracing & bug fixes)

Quick reference when a lesson says "trace the path" or you have a bug to fix.  
**Start here, then grep.** One feature slice at a time — this file is your compass, not the lesson.

**Format for lessons:** Always show the route as a numbered list of **full repo paths** before any code. Learner follows on GitHub top to bottom.

---

## Bug-fix workflow (use every time)

1. **What broke?** UI wrong text, API error, payment stuck, etc.
2. **Which portal?** client / vendor / admin / public
3. **Find the page** → `frontend/app/...` or `frontend/features/...`
4. **Find the types** → `frontend/lib/domain-types.ts`, `*Api.ts` payload/response types
5. **Find the API call** → `frontend/lib/*Api.ts`
6. **Find the contract** → `backend/app/contracts/*.py` (request/response models)
7. **Find the route** → `features/*/http/` (thin handler)
8. **Find business logic** → `backend/app/features/<area>/` (reads/writes via `get_db()`)
9. **Schema only if needed** → `backend/sql/` (migrations or delete/FK bugs)
10. **Run a test** → `backend/tests/` or `frontend/**/*.test.ts`

> **Prefer models over SQL** in explanations. Say "the `booking_requests` table" in prose; show `ClientBookingDetail` or `create.py` inserts instead of `CREATE TABLE`.

---

## Top-level layout

| Path | What lives here |
|------|-----------------|
| `frontend/app/` | Next.js pages (URLs users visit) |
| `frontend/features/` | UI components + view logic per product area |
| `frontend/lib/` | API clients (`clientBookingsApi.ts`), shared types (`domain-types.ts`) |
| `backend/app/main.py` | FastAPI app entry |
| `backend/app/http/router.py` | Registers all API routers |
| `backend/app/features/` | Business logic — **most bugs live here** |
| `backend/app/contracts/` | Request/response shapes (Pydantic) |
| `backend/app/core/` | Config, DB client, logging, errors |
| `backend/sql/` | Postgres migrations (source of truth for tables) |
| `backend/tests/` | pytest |

---

## Common flows (file chains)

### Client creates booking enquiry (slice 3a)

```
VendorBookingModal.tsx
  → clientBookingsApi.ts  CreateBookingRequestPayload (selected_option_ids only)
  → contracts/booking.py  CreateBookingRequestBody / BookingRequestCreated
  → bookings/http/client.py  post_booking_request
  → bookings/create.py  create_booking_request
  → list_pricing.py  resolve_line_items
```

### Client views booking detail (slice 3b)

```
clientBookingsApi.ts  GET .../booking-requests/{id}
  → bookings/http/client.py
  → bookings/queries.py  get_booking_request_for_client
```

### Client pays (slice 4)

```
useClientBookingsController.ts  paymentDue → /pay
  → ClientBookingPayView.tsx → bookingCheckoutApi.ts  POST .../checkout
  → payment_checkout.py → stripe.py
  → payment_finalize.py ← webhooks.py (checkout.session.completed)
  → postBookingCheckoutSync on return URL
```

### Vendor booking lifecycle (slice 5)

```
vendor/bookings/ → useVendorBookingsController.ts
  → vendorBookingsApi.ts  PATCH status / PUT adjustments / POST vendor-quote
  → bookings/http/vendor.py → status.py / adjustments.py / create.py
```

### Payout & completion (slice 6)

```
vendor/payments/ → vendorPaymentsApi.ts  Connect onboarding
  → payments/http/vendor.py → stripe.py
BookingCompletionBanner → payment_completion.py → completion_rules.py
payment_maintenance.py + run_booking_maintenance.py  (auto-release)
payment_refunds.py  (cancel refund)
```

### Chat & notifications (slice 7b)

```
useRealtimeSse.ts → realtime/sse.py
NotificationBell → notifications/http/client.py | vendor.py
ChatThreadView → chat/http/routes.py → chat/service.py
email/dispatch.py  (transactional email from booking events)
```

### Vendor onboarding & admin (slice 7c)

```
vendor/profile → vendors/http/profile.py → moderation.py / visibility.py
reviews.py + admin/http/platform_trust.py
disputes.py + participant_dispute_handlers.py
admin/http/platform_*.py
```

### Login / session (slice 1)

```
frontend auth provider
  → backend/app/features/auth/
```

---

## Minor areas (not full slices)

| Area | Path |
|------|------|
| Help content | `frontend/features/help/`, `backend/app/features/help/` |
| Geo autocomplete | `backend/app/features/geo/` |
| Media uploads | `backend/app/features/media/` |
| UI kit (internal) | `frontend/app/internal/ui-kit/` |

---

## Where *not* to put logic

| Avoid | Put it in |
|-------|-----------|
| Price rules in React components | `backend/app/features/...` |
| SQL in frontend | `backend/sql/` + feature module |
| Business rules in `page.tsx` | `features/<area>/` + API |
| Duplicated types | `contracts/` (backend) + `domain-types.ts` (frontend) |

---

## Useful commands

```bash
# Backend tests (from backend/)
poetry run pytest tests/test_checkout_finalize.py -v

# Grep for a symbol
rg "resolve_line_items" backend/

# Find API route
rg "booking-requests" backend/app/features/bookings/http/
```
