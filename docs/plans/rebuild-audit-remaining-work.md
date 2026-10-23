# Rebuild audit: work left

This is the to-do list after Phases 0 and 1. The full audit, with evidence and reasoning, is in
[`rebuild-audit-2026-10-22.md`](rebuild-audit-2026-10-22.md).

## Done

**Phase 0: critical fixes** (#72, merged).
- Frozen API contract restored and pinned.
- Vendor search no longer leaks client emails.
- The onboarding photo read is restricted to the caller's own uploads.
- The design-diff hook is removed.
- Payments filters and the Held count are computed on the server.
- The notification feed filters and pages in SQL.
- Code branches on error codes, not message text.

**Phase 1: guards before refactors.**
- **Web import boundaries.** ESLint enforces them (`web/eslint.boundaries.mjs`). The shared-feature list
  is in `web/components/README.md`.
- **api guards.** These are now tests:
  - no uncoded `RuntimeError` or `ValueError`
  - `approval_status` filters go through the visibility helpers
  - `.env.example` matches `Settings`
  - `scripts/` is covered by the SQL and commit guards
- **Design-token guard.**
  - No hex colours or violet/purple classes in `features/`.
  - `motion/react` only inside `components/ui`.
- **Fee parity.** The service fee and referral tiers live in `policyConstants.json`, and a test pins them to the api.
- **Freeze suite.** The fixes for the 9 acceptance tests that already failed on `main` ship with the
  Phase 1 PR.

**Phase 4: dead code and docs** (PR "Rebuild audit Phase 4", except `test_list_pagination.py`, which Phase 3 owns).
- **Deleted web files with no importers (grep of every import form, then `npm run build`):**
  `BookingDetailPanel`, the three old help views, `lib/useMediaQuery.ts`, four planner widgets
  (`CelebrationSummary`, `ConfidenceBadge`, `PlannerBookNowButton`, `PlannerNextSteps`), four landing files
  (`LandingBookingRecord`, `LandingCategoriesSection`, `LandingWaitlistCta`, and `LandingScreenshotFrame`, which
  only the others used) and two vendor dashboard cards (`VendorAttentionCard`, `VendorBookingsCalendarCard`).
- **Kept: `MasterDetailLayout`.** Chat imports it, so it stays; only the `UI-CONVENTIONS.md` claim is corrected
  to "used by chat only".
- **Still orphaned, other owners' areas, not deleted:** `client/bookings/{clientBookingListRowUi,clientBookingTrack,
  clientBookingsListTab}.ts`, `reviews/ReviewSummaryHeader`, `vendor/analytics/vendorChartInfoCopy`,
  `vendor/copilot/VendorGrowthGlanceTile`, `vendor/onboarding/ui/{OnboardingOptionPill,OnboardingQuestionLayout}`,
  `lib/{addressApi,api-base,bookingNotificationsApi,bookingsEvents}.ts`. Each needs its owner to confirm.
- **Docs fixed:** `docs/domain-rules.md` (visibility helpers now live in `vendors/service_listing.py` and
  `marketplace/service_explore.py`, and chat checks `listed_vendor`), and the media README (image cap on
  `/media/upload-urls`, the route itself).
- **Tests made real:** `test_media_service.py` asserts the recorded presign request and the response; new
  `test_media_s3_storage.py` checks the signed `presigned_post` policy.
- **UK "today":** new `core/time.py` (`uk_date`, `uk_today`, Europe/London); `domain_portal_dashboard.py` uses it
  (the old code used the server's local zone). `test_core_time.py` pins a BST midnight boundary.

## Open questions and follow-ups from Phase 4

- **Only the portal dashboard uses London "today" so far.** Six sites still use UTC and disagree with it between
  00:00 and 01:00 BST: `vendors/service_moderation.py:600` (insurance expiry), `vendors/service_listing.py:39`
  (listing visibility), `vendors/service_profile.py:33`, `bookings/service_admin_financials.py:124`,
  `marketplace/service_analytics.py:22`, `admin_insights/domain.py:32`. Each belongs to a different owner, so
  move them to `core.time.uk_today()` as follow-ups. The dashboard service also calls the clock once per helper;
  compute `uk_today()` once and pass `today=` to all three, then make it required.

### Decision for you: should a client shown as "Client" be searchable by vendors?

Vendor search matches the name a vendor sees. A client with no preferred name and no email-derived name is shown
as the fallback "Client", and a closed account shows nothing, so neither can be found by typing a name. This phase
changed nothing. Options: (a) leave it, since there is nothing meaningful to search; (b) make the fallback client
findable by email, which exposes the email the Phase 0 fix stopped leaking, so I advise against it. Which do you want?

## Before the next deploy (yours, about 5 minutes)

1. **Check live upload URLs.** Profile save now keeps only image URLs whose key starts with `users/<id>/`.
   On the hosted DB, look for vendor payload image URLs on the bucket host whose path does not start with
   `/users/`. If any exist, tell an agent to migrate them before deploying.
2. **Check the S3 IAM policy.** If the api role lacks `s3:ListBucket`, a missing photo shows as a 502
   instead of a 404. Either add the permission or accept the 502.

## Phase 2: one design system (biggest; one PR per area)

Decision already taken: keep the canvas look (`eventtz.css`, `ez-*`), make the `components/ui` building
blocks render it, and have screens use the blocks. There should be no visual change, proven with the
design-diff run.

1. **Tokens (platform).**
   - `globals.css` tokens point at `var(--ez-*)`.
   - `ui/tokens.ts` emits `ez-*` classes.
   - `eventtz.css` goes inside `@layer components`.
   - Delete `portalTheme.ts`, `adminTheme.ts` and `sectionBlockTokens.ts` after moving their importers.
2. **Building blocks (platform).**
   - Rewrite these to output canvas markup: `Button`, `Card`, `Badge`, `Banner`, `Tabs`, `StatTile`,
     `PageHeader`, `DescriptionList`, `Stepper`, `TextField`/`Select`/`TextArea` (absorbing
     `EzClearableInput`), `EmptyState` and `TablePagination`.
   - Add `DataTable` to replace `AdminTable` and the raw tables.
3. **Collapse the duplicates.**
   - `Client/Vendor/AdminEzPageHead` → `PageHeader`
   - `AdminKpiCard`, `StatCard` and `VendorMetricsStrip` → `StatTile`
   - The six `Field` helpers → `DescriptionList`
   - `ez-form`/`form-primitives` (now in `components/ui`) → `TextField`
   - Local status-badge functions → `Badge`
   - Hand-rolled alerts and pills → `Banner`/`Chip`
   - Old admin filters → the `Ez*` filters
4. **Migrate screens, one PR per owner area.**
   - Start with the worst files: `WizardAside`, `StepReview`, `StepPortfolio`, `VendorSettingsEzView`,
     `vendorDetailsShared`, `VendorBookingModal`, `HelpWidget`.
   - Replace inline `style={{}}` and `neutral-*` with tokens.
5. **Merge client/vendor twins.**
   - The bookings lists become one `BookingsEzList`.
   - The settings, payments and notifications pairs move onto shared sections.
6. **Tighten the web boundaries** (follow-ups from the Phase 1 review).
   - Share named sub-paths instead of whole areas in `SHARED_FEATURE_MODULES`
     (`web/eslint.boundaries.mjs`).
   - Move `settings/ChangePasswordModal` and the landing chrome to `components/`.
   - Add a test that the README table equals the list.
   - Add stale-entry tests for `SHARED_FEATURE_MODULES`, `AREA_COMPOSES` and
     `COMPONENT_FEATURE_ALLOW_LIST`.
   - Build the `ui` block's rule from a shared constant.
   - `ClientEzPageHead`, `VendorEzPageHead`, `AdminErrorBanner`, `ez-form` and `form-primitives` moved
     into `components/ui` only to clear the boundary rule, and are deleted by step 3.
7. **Docs and guard.**
   - Keep one design rule across `components/README.md`, `UI-CONVENTIONS.md` and the design-diff README.
   - Prune unused `ez-*` classes and define the missing ones.
   - Guard against raw `ez-btn|ez-card|ez-badge|ez-banner|ez-pagehead|ez-kpi` in features.

Proof for every PR: design-diff prints `PASS` for every screen, plus web tests, the build and lint
compared with `main`.

## Phase 3: shared lists, types and formatting

1. **api pagination kernel (platform, then each slice).**
   - In `core/pagination.py`, add `PageParams` (default 25), a shared `total/offset/limit` response base,
     a `paged()` helper with a primary-key tie-breaker, and `escape_like()` for the 16 `ilike` sites.
   - Migrate the ~30 routers, ~20 schemas and the repository copies.
   - Move payout history and admin daily financials from in-memory slicing to SQL.
   - Add a guard: routers use `PageParams`.
2. **ADR 0011, list page size 25.** A draft ships with Phase 1; finish it with the full list of routes.
3. **Merge the api twins.**
   - The disputes and notifications client/vendor routers become one factory each.
   - The bookings list-item builders get one shared builder.
4. **Errors.**
   - Remove the duplicate codes: `invalid_booking_id`, `no_fields_to_update`, `account_deleted`,
     `session_expired`.
   - `test_visibility_helpers_only` misses `.notin_`/`.is_`/`filter_by(approval_status=)`/dict-row access; widen it.
5. **Web lists.**
   - Add one `useServerList` hook and build the bookings scaffold on it.
   - Migrate the ~23 hand-rolled list views and put `EzListFilterToolbar` on every list screen.
   - Delete the `limit: 200` wrappers.
   - Replace the dispute 50-second poll with realtime.
   - Remaining page-only KPIs: vendor "Next release" and admin referrals "Active creators".
6. **Generated API types (ADR 0007).**
   - Add `openapi-typescript` (dev dependency, approved), `npm run api:types` and a CI drift check.
   - Add an api test that `openapi.json` is fresh.
   - Migrate the `lib/*Api.ts` types, starting with bookings, dashboards and payments.
   - Update the AGENTS.md trap about hand-written types.
7. **Formatting.**
   - One `lib/money.ts` (`formatGbp`, `formatPence`, en-GB).
   - `lib/dateFormat.ts` is the only date formatter.
   - Delete about 16 local copies and about 20 inline `toLocaleString` money sites, and add a guard.

## Phase 4: dead code and docs

- Delete the orphaned files below after confirming they have no importers:
  - `features/bookings/BookingDetailPanel.tsx`
  - the old help views `HelpCenterView`, `HelpCategoryView` and `HelpArticleView`
  - the unused planner, landing and dashboard widgets
  - `lib/useMediaQuery.ts`
  - `MasterDetailLayout` and its doc claim, if only chat uses it
- Fix the stale docs:
  - `docs/domain-rules.md:188` (`vendors/moderation.py`)
  - `api/app/features/media/README.md` (size caps, `/media/upload-urls`)
- Make the shape-only tests real:
  - `test_list_pagination.py`: seed limit+1 rows and assert exact pages.
  - `test_media_service.py`: assert what was recorded.
  - Add an adapter test for `presigned_post`.
- `domain_portal_dashboard.py` takes "today" from `core/time` (Europe/London).
- Vendor search: decide whether clients shown as "Client" should be searchable.

## Out of scope (needs its own ADR)

- Integer pence across the api money domains (`pricing`, `referrals`, `domain_price_list`), and
  formatting only at the edge. This changes goldens, so it is a separate money-owner project.

## How to run it

In a new session, say **"continue the rebuild audit from `docs/plans/rebuild-audit-remaining-work.md`"**.
Each item goes to its owner agent (`.claude/OWNERS.md`) and then `quality-reviewer`. Money, auth, CI,
guard and migration work also needs `reviewer` (opus) and `/security-review`. Each phase or area is its
own PR.

For local testing without Docker:
- Start Postgres 16 from `/usr/lib/postgresql/16/bin` on :5434 and `redis-server --port 6381`.
- For api tests, set `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<db>`.
