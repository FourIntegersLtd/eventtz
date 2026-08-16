# Slice 6 — Payout, completion, refunds (outline)

**Status:** not started — full lesson to be written when this slice is taught.

**Plan:** [FEATURE_TRACK.md § Slice 6](../FEATURE_TRACK.md#slice-6--payout-completion-refunds)

### User story

A vendor completes Stripe Connect, both parties confirm event completion (or auto-release fires), funds transfer to the vendor; paid cancellations refund the client.

### Complete route

**Connect onboarding**

1. `frontend/app/vendor/(portal)/payments/page.tsx`
2. `frontend/features/vendor/payments/VendorPaymentsView.tsx`
3. `frontend/features/vendor/payments/VendorPayoutAccountPanel.tsx`
4. `frontend/lib/vendorPaymentsApi.ts`
5. `backend/app/features/payments/http/vendor.py`
6. `backend/app/features/payments/stripe.py`

**Dual completion → payout**

7. `frontend/features/bookings/BookingCompletionBanner.tsx`
8. `frontend/features/bookings/BookingPayoutPendingBanner.tsx`
9. `frontend/lib/clientBookingsApi.ts` — `postClientConfirmCompletion`
10. `frontend/lib/vendorBookingsApi.ts` — `postVendorConfirmCompletion`
11. `backend/app/features/bookings/payment_completion.py`
12. `backend/app/features/bookings/completion_rules.py`

**Auto-release + refunds**

13. `backend/app/features/bookings/payment_maintenance.py`
14. `backend/app/jobs/run_booking_maintenance.py`
15. `backend/app/features/bookings/status.py` — cancel
16. `backend/app/features/bookings/payment_refunds.py`

### Key concepts

- Connect ≠ vendor profile onboarding
- Dual completion → Stripe Transfer
- Auto-release after event
- Refund-before-cancel on paid bookings
