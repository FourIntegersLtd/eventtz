Task: ws14 client portal, piece 6 (bookings).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/bookings and /client/bookings/[bookingId]
Baseline: frontend/app/client/(portal)/bookings/ (layout.tsx, page.tsx, [bookingId]/page.tsx)
→ frontend/features/client/bookings/ (ClientBookingsPortal.tsx, ClientBookingsView.tsx,
ClientBookingDetailExtras.tsx, ClientBookingReviewForm.tsx, clientBookingViewModel.ts,
useClientBookingActions.ts, useClientBookingsController.ts), frontend/lib/clientBookingsApi.ts,
booking-messages.ts, reviewTypes.ts, reviewsApi.ts.
API: GET /api/v1/client/booking-requests, GET /api/v1/client/booking-requests/{booking_id},
POST .../{booking_id}/cancel, POST .../{booking_id}/confirm-completion,
PUT/PATCH .../{booking_id}/venue, POST .../{booking_id}/review,
GET .../{booking_id}/status (check the methods in schema.d.ts).
Pattern: web/src/domains/vendor-bookings (list + detail for vendors).
New domain: web/src/domains/client-bookings. Pure logic to test: port
clientBookingViewModel.ts (status labels, which actions are allowed in which state,
price display in pence), the review form validation and request body, the venue form body.
The "Pay" button links to /client/bookings/[bookingId]/pay (piece 7 builds it). The
"Receipt" link is out of scope (ws12): hide it and report it.
useClientBookingPaymentReturn.ts (the return from Stripe) belongs to piece 7: skip it here.

## Allowed paths
web/src/app/client/(portal)/bookings/** (not pay/ or receipt/),
web/src/domains/client-bookings/**.
Commit: "web: client bookings list and detail (ws14)"
