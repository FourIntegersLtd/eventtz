Task: ws14 client portal, piece 7 (pay and payments).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/bookings/[bookingId]/pay and /client/payments
Baseline: frontend/app/client/(portal)/bookings/[bookingId]/pay/page.tsx and
payments/page.tsx → frontend/features/client/payments/ (ClientBookingPayView.tsx,
ClientPaymentsView.tsx, PaymentSafetyModal.tsx, bookingPayHelpers.ts, useClientBookingPay.ts,
paymentFlowCopy.test.ts, useClientBookingPay.test.ts), frontend/features/client/bookings/
useClientBookingPaymentReturn.ts, frontend/lib/bookingCheckoutApi.ts.
API: POST /api/v1/client/booking-requests/{booking_id}/checkout (returns the Stripe
Checkout URL), POST .../{booking_id}/checkout/sync (after Stripe redirects back),
GET /api/v1/client/booking-requests (for the payments list).
This is money: follow the baseline exactly. The browser only redirects to the URL the api
returns; never compute or send a price from the client. Handle the Stripe return
(success and cancel query params) by calling checkout/sync, then show the result.
Branch on PlatformError.code for every failure the baseline handles.
Build this inside web/src/domains/client-bookings (from piece 6), so it can reuse the
booking view logic: a domain may not import another domain. Port both baseline test
files' cases to node --test against plain .ts modules (pay-state logic, copy,
return-URL parsing).

## Allowed paths
web/src/app/client/(portal)/bookings/[bookingId]/pay/**,
web/src/app/client/(portal)/payments/**, web/src/domains/client-bookings/**.
Commit: "web: client booking payment and payments page (ws14)"
