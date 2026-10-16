Task: ws14 client portal, piece 12 (vendor profile and booking request).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: /client/browse/[userId], the booking request modal, the browse split layout
Baseline: frontend/app/client/(portal)/browse/[userId]/page.tsx →
frontend/features/client/browse/ (ClientVendorBrowseDetailView.tsx, VendorBrowseDetailBody.tsx,
VendorBrowseBreadcrumb.tsx, BrowseProfileFactRow.tsx, BrowseProfileGoodToKnowCard.tsx,
VendorReviewsSection.tsx, VendorBookingModal.tsx, ClientBrowsePortalLayout.tsx,
browseLabels.ts, browseVendorFacts.ts, vendorBrowseDetailModel.ts, usePerUnitPackageSelection.ts,
useVendorBookingSubmit.ts, useExploreVendor.ts, useVendorReferralPreview.ts and the three
*.test.ts files), frontend/lib/bookingEnquireSubmit.ts, bookingServiceFee.ts,
packagePricing.ts, vendorAvailability.ts, vendorDiscountDisplay.ts, eventDateValidation.ts,
validation/bookings.ts, vendorReferralAttribution.ts.
API: GET /api/v1/vendors/explore/vendor/{vendor_user_id},
GET .../vendor/{vendor_user_id}/referral-preview, GET /api/v1/vendors/{vendor_user_id}/reviews,
POST /api/v1/client/booking-requests, and the geo endpoints
(/api/v1/client/geo/address-autocomplete, address-find, address-resolve/{address_id})
if the modal asks for an address.
Money rule: prices shown come from the vendor payload the api returns; the booking
request sends only what the baseline sends. Never send a price the browser computed.
Plan with the planner first. Port all three baseline test files to node --test against
plain .ts modules (detail model, per-unit package selection, booking submit body).
Put this in web/src/domains/marketplace (from piece 11) so it reuses the search params
and cards: a domain may not import another domain.
ClientBrowsePortalLayout is the split layout the portal layout uses on browse pages:
add it to web/src/app/client/(portal)/layout.tsx as the baseline does.

## Allowed paths
web/src/app/client/(portal)/browse/**, web/src/app/client/(portal)/layout.tsx,
web/src/domains/marketplace/**.
Commit: "web: client vendor profile and booking request (ws14)"
