# Piece 01 — web: public vendor profile page `/client/browse/[userId]` (read-only)

First read `.qwen/next20/rules-web.md` and follow it in full.

## Goal
A client, a guest or anyone else opens a vendor from browse and sees the baseline profile page:
- gallery;
- about;
- services and events;
- coverage;
- reviews;
- the pricing sidebar with package selection and the fee estimate;
- "Before you book";
- bookmark.

This piece has **no booking submit**. "Request booking" opens nothing yet: see "Hand-off to piece 02" below. This piece also makes `/client/browse*` **public**, as the baseline does.

## Part A — make /client/browse public (layout split)
The baseline layout is `frontend/app/client/(portal)/layout.tsx`, together with `frontend/features/client/browse/ClientBrowsePortalLayout.tsx`:
- If `pathname.startsWith("/client/browse")`, the layout does NOT require auth.
- While the session is loading, it shows a spinner with "Loading browse…".
- If the user is not a client (a guest, vendor or admin), it renders the children with **public marketplace chrome**. That chrome is `MarketplaceBrowseShell`: `LandingNav` plus a `<main>` of max width `max-w-7xl` on the list and `max-w-[90rem]` on the detail page, with padding `px-4 pb-8 pt-24 sm:px-6 sm:pb-10 sm:pt-28 lg:px-8`.
- If the user is a client, it renders the normal client `PortalShell`, `ClientOnboardingProvider` and `ClientWelcomeOnboardingModal`.

In web:
1. Edit `web/src/app/client/(portal)/layout.tsx`. Read `usePathname()` and branch:
   - Browse paths render a new `ClientBrowseLayout`.
   - Every other path keeps today's tree unchanged.
2. Create `web/src/app/client/(portal)/browse/ClientBrowseLayout.tsx`. Keep it in app/: it composes two domains, which is allowed only in app/.
   - Use `useSession()` from `@/foundation/session`. `status === "loading"` means a `Spinner` with the label "Loading browse…".
   - `session?.user.user_type === "client"` means the same PortalShell tree as the portal layout. Extract that tree into a small component in the same layout file, so it is written once and used by both branches.
   - Otherwise, wrap the children in `MarketingShell` from `@/domains/marketing/MarketingShell`. Pass a width prop, `"wide" | "detail"`, if you add one to MarketingShell; the detail page gets `"detail"`. If MarketingShell can't take a width without affecting marketing pages, add an optional `width` prop that defaults to today's layout.
3. Check the browse list (`MarketplaceExploreView`) for guests. Explore routes on api are public (`api/app/features/marketplace/router.py` has no auth dependency).
   - Favorites calls must not run for a guest. `useMarketplaceBookmarks` must handle `anonymous`: baseline guests keep bookmarks in local storage, and `marketplaceBookmarkMerge.ts` exists for the merge.
   - If the hook already guards this, leave it. If it doesn't, guard it: guests see bookmarks from local storage only.
4. The favorites mode (`?view=favorites` or equivalent) still needs a client. Read how the baseline handles a guest there and match it.

## Part B — the vendor profile page
Baseline files: read them all once.
- `frontend/app/client/(portal)/browse/[userId]/page.tsx` (17 lines)
- `frontend/features/client/browse/`:
  - `ClientVendorBrowseDetailView.tsx` (283 lines): top-level;
  - `VendorBrowseDetailBody.tsx` (421): the layout;
  - `VendorBrowseBreadcrumb.tsx` (60): Home › category › name; exports `vendorBrowseCategoryLabel`;
  - `BrowseProfileFactRow.tsx` (69);
  - `BrowseProfileGoodToKnowCard.tsx` (69): exports `hasBrowseGoodToKnowContent`;
  - `VendorReviewsSection.tsx` (267): carousel, dots, "See all reviews" modal, expand/collapse, relative time;
  - `browseLabels.ts` (47);
  - `browseVendorFacts.ts` (191);
  - `vendorBrowseDetailModel.ts` (377): pricing options;
  - `usePerUnitPackageSelection.ts` (105);
  - `useExploreVendor.ts` (41);
  - `useVendorReferralPreview.ts` (106).
- Supporting lib, none of it ported yet:
  - `frontend/lib/packagePricing.ts` (58)
  - `frontend/lib/vendorDiscountDisplay.ts` (235)
  - `frontend/lib/bookingServiceFee.ts` (102, has a test)
  - `frontend/lib/vendorReferralAttribution.ts` (53, has a test)
  - `frontend/lib/vendorAvailability.ts` (105, has a test). Port it here because the page shows availability; piece 02 uses its conflict check.
- Tests to port. Keep these exact case names:
  - `frontend/features/client/browse/usePerUnitPackageSelection.test.ts`, describe "syncPerUnitPackageSelection":
    - "auto-selects per-unit packages when quantity meets minimum"
    - "deselects per-unit packages when quantity drops below minimum"
    - "leaves fixed packages unchanged when quantity updates"
  - `frontend/features/client/browse/vendorBrowseDetailModel.test.ts`, describe "browse per-unit pricing":
    - "exposes unit rate and suffix on browse options"
    - "multiplies unit rate by quantity for booking estimates"
    - "only sends quantities for per-unit options"
    - "keeps empty selection total at GBP 0.00"
    - "clamps per-unit quantities to package minimums"
    - "returns undefined when no per-unit packages are selected"
  - `frontend/lib/bookingServiceFee.test.ts`, `frontend/lib/vendorReferralAttribution.test.ts` and `frontend/lib/vendorAvailability.test.ts`: port every case.

API: all of these are in schema.d.ts already.
- `GET /api/v1/vendors/explore/vendor/{vendor_user_id}`: already wrapped as `fetchExploreVendorById` in `web/src/domains/marketplace/api.ts`.
- `GET /api/v1/vendors/explore/vendor/{vendor_user_id}/referral-preview`: add it to the marketplace `api.ts`.
- `GET /api/v1/vendors/{vendor_user_id}/reviews`: add it to the marketplace `api.ts`.

Where things go (everything under `web/src/domains/marketplace/`):
- Pure .ts, each with a `.test.ts`:
  - `packagePricing.ts`
  - `vendorDiscountDisplay.ts`
  - `bookingServiceFee.ts`
  - `vendorReferralAttribution.ts`
  - `vendorAvailability.ts`
  - `browseLabels.ts`
  - `browseVendorFacts.ts`
  - `vendorBrowseDetailModel.ts`
  - `perUnitPackageSelection.ts`: the pure `syncPerUnitPackageSelection`.
- Hooks: `useExploreVendor.ts`, `usePerUnitPackageSelection.ts` and `useVendorReferralPreview.ts`, all using the derived-loading pattern.
- Views:
  - `VendorProfileView.tsx`: top-level. It takes `vendorUserId` and an optional `renderBookingModal` slot for piece 02.
  - `VendorProfileBody.tsx`
  - `VendorProfileBreadcrumb.tsx`
  - `ProfileFactRow.tsx`
  - `GoodToKnowCard.tsx`
  - `VendorReviewsSection.tsx`

  Split the views as the baseline does; keep each file under ~300 lines.
- Route: `web/src/app/client/(portal)/browse/[userId]/page.tsx`. Use `Suspense` around the view, as the baseline does (it reads search params).

Behaviour to match exactly:
- The back link and breadcrumb keep the marketplace search state. Use `buildClientBrowseVendorUrl` / `buildMarketplaceSearchUrl` in `marketplaceSearchParams.ts`; the list href is `/client/browse` with the same state.
- A referral code in the URL is captured on load (`captureVendorReferralFromSearchParams`) and stored in local storage, as in the baseline.
- Loading, not-found and error states use the baseline's copy.
- Guests see the register/login CTAs where the baseline shows them. Links: `/register?type=client` and `/login?next=<current url>`. Check the baseline for the exact hrefs.
- Signed-in clients see "Request booking" and "Message vendor":
  - "Message vendor" links to `/client/messages?vendor=<id>`, or to whatever the baseline's fallback is when ChatDrawer is absent. ChatDrawer arrives in piece 19; until then, link to the message thread the way the baseline's non-drawer path does. If the baseline has none, link to `/client/messages`.
  - "Request booking" calls `onRequestBooking()`, a prop. In this piece the page passes a handler that does nothing but set `bookingOpen` state, which renders nothing yet.
- The fee estimate uses `computeClientFeeBreakdown` for **display only**. Nothing in this piece sends a price.
- Portfolio video: the baseline `PortfolioVideoStrip` needs a video player package, which is out of scope. Show video links as plain `<a>` links and list this in your report.
- Carousel: build the reviews carousel with plain state and buttons. No package.

## Hand-off to piece 02
Export `VendorProfileView` with a prop `bookingModal?: (args: { open: boolean; close: () => void; pricingOptions; selectedIds; quantities }) => ReactNode`. Use your real type names. Piece 02 fills it in; keep the selection state inside the view.

## Allowed paths
- `web/src/app/client/(portal)/layout.tsx`
- `web/src/app/client/(portal)/browse/**`
- `web/src/domains/marketplace/**`
- `web/src/domains/marketing/MarketingShell.tsx` (only the optional width prop)

## Browser check (also closes piece 11's owed check)
With api :8001 and web :3001 running:
1. Signed out, open `/client/browse` and a vendor's page. Expect public chrome and no redirect to login.
2. Signed in as an @example.com client, the same pages show the portal sidebar.
3. At 375px width, open the filters panel on `/client/browse`, change a filter and check that the panel stays open and focus stays put.

Report what you saw.

## Commit
`web: public vendor profile page and browse layout split (ws14 piece 12a)`
