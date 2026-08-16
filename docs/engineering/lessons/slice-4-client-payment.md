# Slice 4 — Client payment (outline)

**Status:** not started — full lesson to be written when this slice is taught.

**Plan:** [FEATURE_TRACK.md § Slice 4](../FEATURE_TRACK.md#slice-4--client-payment)

### User story

A client with an **accepted + unpaid** booking pays via Stripe Checkout; payment is finalized by webhook (with sync fallback on return).

### Complete route

**Frontend**

1. `frontend/features/client/bookings/useClientBookingsController.ts` — `paymentDue`, `onPayNow`, checkout return `?payment=success`
2. `frontend/features/client/bookings/ClientBookingDetailExtras.tsx` — payment banner
3. `frontend/app/client/(portal)/bookings/[bookingId]/pay/page.tsx`
4. `frontend/features/client/payments/ClientBookingPayView.tsx`
5. `frontend/features/client/payments/useClientBookingPay.ts`
6. `frontend/features/client/payments/PaymentSafetyModal.tsx`
7. `frontend/lib/bookingCheckoutApi.ts` — `postBookingCheckout`, `postBookingCheckoutSync`
8. `frontend/lib/clientBookingsApi.ts` — `patchClientBookingVenue` (venue before pay)

**Backend**

9. `backend/app/features/bookings/http/client.py` — `POST .../checkout`, `POST .../checkout/sync`
10. `backend/app/contracts/payments.py`
11. `backend/app/features/bookings/payment_checkout.py` — `create_checkout_session_for_booking`
12. `backend/app/features/bookings/payment_finalize.py`
13. `backend/app/features/payments/http/webhooks.py`
14. `backend/app/features/payments/stripe.py`
15. `backend/app/core/db.py`

### Key concepts

- Held-funds model (platform balance first; vendor Transfer in slice 6)
- Server recomputes pricing before Checkout
- `payment_status`: `unpaid` → `pending` → `paid`
- Webhook idempotency + sync fallback
