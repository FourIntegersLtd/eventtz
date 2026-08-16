# Slice 5 — Vendor booking lifecycle (outline)

**Status:** not started — full lesson to be written when this slice is taught.

**Plan:** [FEATURE_TRACK.md § Slice 5](../FEATURE_TRACK.md#slice-5--vendor-booking-lifecycle)

### User story

A vendor manages booking requests: accepts/declines client enquiries, sends quotes from chat, suggests price adjustments, and withdraws their own quotes.

### Complete route

**Vendor portal**

1. `frontend/app/vendor/(portal)/bookings/page.tsx` + `[bookingId]/page.tsx`
2. `frontend/features/vendor/bookings/VendorBookingsView.tsx`
3. `frontend/features/vendor/bookings/useVendorBookingsController.ts`
4. `frontend/features/vendor/bookings/VendorBookingResponseFlow.tsx`
5. `frontend/features/vendor/bookings/VendorBookingResponseAdjustments.tsx`
6. `frontend/features/vendor/bookings/vendorBookingResponseHelpers.ts`
7. `frontend/features/bookings/useParticipantBookingsScaffold.ts`

**Vendor quote from chat**

8. `frontend/features/chat/ChatThreadView.tsx`
9. `frontend/features/vendor/quotes/VendorQuoteFormModal.tsx`

**Payout gate**

10. `frontend/features/vendor/payments/useVendorPayoutsReady.ts`
11. `frontend/features/vendor/payments/PayoutSetupRequiredModal.tsx`

**API + backend**

12. `frontend/lib/vendorBookingsApi.ts`
13. `backend/app/features/bookings/http/vendor.py`
14. `backend/app/contracts/booking.py`
15. `backend/app/features/bookings/create.py` — `create_vendor_quote_booking_request`
16. `backend/app/features/bookings/status.py` — `update_booking_request_status_for_vendor`
17. `backend/app/features/bookings/adjustments.py`
18. `backend/app/features/bookings/pricing_confirmation.py`

### Key concepts

- `initiator` flips who accepts while `pending`
- Vendor adjustments write path (client confirm in 3b)
- Payout readiness gate before vendor accept
