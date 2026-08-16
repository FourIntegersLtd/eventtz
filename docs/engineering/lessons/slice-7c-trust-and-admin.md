# Slice 7c — Trust, vendor onboarding & admin (outline)

**Status:** not started — full lesson to be written when this slice is taught.

**Plan:** [FEATURE_TRACK.md § Slice 7c](../FEATURE_TRACK.md#slice-7c--trust-vendor-onboarding--admin)

### User story

Vendors complete listing onboarding; clients leave reviews; participants raise disputes; admins approve vendors, oversee commerce, and manage trust/blog/referrals.

### Complete route

**Vendor onboarding**

1. `frontend/app/vendor/(portal)/profile/page.tsx`
2. `frontend/features/vendor/onboarding/VendorOnboarding.tsx`
3. `backend/app/features/vendors/http/profile.py` + `moderation.py` + `visibility.py`

**Reviews**

4. `frontend/features/client/bookings/ClientBookingReviewForm.tsx`
5. `frontend/app/vendor/(portal)/profile/reviews/page.tsx`
6. `backend/app/features/bookings/reviews.py`

**Disputes**

7. `frontend/features/disputes/` + `BookingDisputeSection.tsx`
8. `backend/app/features/bookings/disputes.py` + `participant_dispute_handlers.py`

**Admin console**

9. `/admin/dashboard` → `frontend/features/admin/dashboard/`
10. `/admin/directory` → `admin/http/platform_directory.py`
11. `/admin/commerce` → `platform_bookings.py`, `platform_financials.py`
12. `/admin/trust` → `platform_trust.py`
13. `/admin/bookings/[id]` → `AdminBookingDetailView.tsx`
14. `/admin/referrals` → `backend/app/features/referrals/http/admin.py`
15. `/admin/blog` + public `/blog` → `backend/app/features/blog/`

### Key concepts

- Vendor approval gates explore listing (slice 2 `visibility.py`)
- Reviews post-`completed` only
- Disputes can hold payout (slice 6)
- Admin is staff-only (slice 1 guards)
