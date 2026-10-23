# Rebuild audit: work left

This is the to-do list after Phases 0 and 1. The full audit, with evidence and reasoning, is in
[`rebuild-audit-2026-10-22.md`](rebuild-audit-2026-10-22.md).

## Done

**Admin console screens, platform-owned part** (PR "Rebuild audit: admin screens on the design system and server lists").
- `OWNERS.md` gives platform-owner only admin blog, dashboard, report-bug, settings, layout and components. Blog list is now on `useServerList`; `fetchAdminBlogPosts` (the `limit: 200` wrapper, no callers) is deleted. Cards, buttons, badges and the success banner in those folders use `Card`, `Button`/`ButtonLink`, `Badge`, `Banner`; the last inline `style` and `neutral-*` classes are gone.
- Two-server comparison (seeded 40 posts, pages 1 and 2, desktop and 390px) and dashboard, report-bug, settings and editor screenshots against main: at most 0.012% mismatching pixels.
- Not done here, owned by others (still to move onto `useServerList` / `DataTable`): audit, clients (incl. the raw `ez-dl` in `AdminClientsView`) and team (access-owner); bookings, disputes, reviews (bookings-owner); financials, referrals, referral signups (money-owner); marketplace analytics (marketplace-owner); messages inbox (comms-owner); vendors (vendors-owner).

**Phase 3 item 5 (start) and Phase 2.3 (finish): shared list hook and the last duplicate components** (PR "Rebuild audit: shared list hook and the last duplicate components").
- `web/lib/useServerList.ts` (offset/limit default 25, total, filters, search; offset resets when they change) with literal-value tests. The bookings scaffold is built on it.
- Client and vendor bookings lists are one `BookingsEzList` with a `perspective` prop. `EzListFilterToolbar` takes `searchId`.
- No `limit: 200` wrapper is left. Still fixed-limit: `limit: 100` in `features/reviews/VendorReviewsEzView.tsx` (`fetchVendorOwnReviews`).
- Phase 2.3 collapses finished: Field helpers to `DescriptionList`/`DescriptionRow`, StatCard/VendorMetricsStrip to `StatTile` (`compact`), `form-primitives` to `TextField`/`Select`/`TextArea` (`hideLabel`), `AdminFilterDateField` to `ui/EzFilterDateField`, hand-rolled alerts and pills to `Banner`/`Chip`. Structured alert cards (payout pending, price update, date change, pricing breakdown, refund box) were left on purpose.
- Still to move onto `useServerList` (by owner). Admin (platform): audit, blog list, bookings, clients, disputes, financials, marketplace analytics, messages inbox, referral signups, referrals, reviews, team, vendors. Portal: client and vendor payments (money), participant and vendor disputes (bookings), notifications and chat/messages (comms), vendor reviews (bookings).

**Phase 3.7: one money and date formatter.**
- `web/lib/money.ts` (`formatGbp`, `formatPence`, `formatCount`, `formatMoney`) and `web/lib/dateFormat.ts` (`formatDate` with named styles) are the only formatters. About 16 local copies and the inline `toLocaleString` / `Intl` sites were migrated and deleted.
- `web/lib/formatGuard.test.ts` fails on new inline money or date formatting, with a meta-test.
- Each screen keeps its old output through an option (`decimals`, `prefix`, `grouping`). Known changes: negatives read "-£x", `formatMoney` is fixed to en-GB, half-penny vendor inputs round like Intl instead of `toFixed`.

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

- **Phase 2.1 (tokens and blocks).** `globals.css` tokens are `var(--ez-*)`, `eventtz.css` loads in
  `@layer components`, `ui/` blocks emit canvas `ez-*` markup (new `DataTable`, `TextField` absorbs
  `EzClearableInput`), `adminTheme.ts` and `sectionBlockTokens.ts` are deleted. design-diff results are
  identical to main (within 0.05%) on all 33 screens; the failures (P01, V01-V07, V13, V18, V19, V23, V24 and the
  V11 `.ez-kpi` setup timeout) also fail on main. Deferred: raw tables not yet on `DataTable`.
- **Phase 2.3 (collapse duplicates).** `Client/Vendor/AdminEzPageHead` are now `PageHeader`; `AdminKpiCard` is
  `StatTile`; `AdminTable` is `DataTable` (11 admin tables); `ez-form` is `TextField`/`TextArea`/`Checkbox`/
  `OptionCard`/`Chip`; local status badges are `Badge`; `AdminCommercePeriodFilter`/`AdminFilterBar`/
  `adminFilterControlClass` are the `Ez*` filters. Deferred, not an exact render match: the six `Field` helpers
  (Tailwind rows, not `ez-dl`), `StatCard`/`VendorMetricsStrip`, `form-primitives`, `AdminFilterDateField`,
  hand-rolled alerts and pills.
- **Phase 2.6 (web boundaries).** `SHARED_FEATURE_MODULES` names sub-paths only (no whole area); the landing
  chrome (`LandingNav`, `LandingFooter`, `LandingSection`, `landingSectionStyles`, `useLandingNavScroll`, new
  `landingChromeData`) is `components/landing/` and `ChangePasswordModal` is `components/auth/`, so
  `CompliancePageShell` and `ComplianceReader` left the allow-list. `lib/eslintBoundariesLists.test.ts` checks
  every shared, composes and allow-list entry still exists and is used, and that the README table equals the
  list. The `ui` rule shares `COMPONENT_BOUNDARY_RULE`. Skipped (another agent deletes them): `ClientEzPageHead`,
  `VendorEzPageHead`, `AdminErrorBanner`, `ez-form`, `form-primitives`. ESLint errors 128, same as main.

**Phase 3 (api half): one pagination kernel, merged twins, one error code each.**
- **Pagination kernel.** `core/pagination.py` holds `PageParams`/`PageDep` (default 25), `PagedResponse`,
  `paged()` (primary-key tie-breaker) and `escape_like()`. Every list router, schema and repository uses
  it; `test_routers_use_page_params.py` guards it. Payout history and admin daily financials page in SQL.
  ADR 0011 lists every route and the two default changes (audit log, admin reviews: 100 to 25).
- **Twins merged.** `disputes/router_participant.py` and `notifications/router_portal.py` build the
  client and vendor routes from one factory (operation ids unchanged); the bookings client and vendor
  list rows share `_shared_list_fields`.
- **Error codes.** `invalid_booking_id` and `no_fields_to_update` are one class each in `core/errors.py`;
  `session_expired` and `account_deleted` reuse the `core/auth.py` classes with a message override.
  `test_visibility_helpers_only` also catches `.notin_`, `.is_`, `filter_by` and dict-row access.
- **Generated API types (Phase 3.6).** `npm run api:types` writes `web/lib/api-schema.d.ts` from `api/openapi.json`;
  `npm run api:types:check` runs in `ci-web` and `test_openapi_fresh.py` keeps `openapi.json` fresh. Response
  schemas mark every field required (`app/openapi.py`). Bookings (client and vendor), both dashboards,
  vendor payments, `/auth/me` and explore now alias the generated schema; `lib/api-types.ts` is deleted.
  Phase 3.6b: every other `lib/*Api.ts` now aliases the generated schema (`lib/apiTypeHelpers.ts` `WithFields`
  narrows a field); `lib/noHandWrittenApiShapes.test.ts` fails on a hand-written type named like a schema.
  Still hand-narrowed because the API types them as free-form dicts (candidates for pydantic models):
  vendor analytics (`overview`, `funnel`, `*_by_month`), admin marketplace analytics, chat `metadata`,
  admin booking `booking` and `support.open_dispute`, admin vendor insights `bookings_by_month`, copilot
  `package_feedback`, `profile_form_data`. Drift found: the planner vendor card and `chat_included_for_review`
  on disputes are read by screens but not sent by the API; `message_role` on help/copilot history is sent
  while the schema shows its `role` alias; `addressApi.ts` is only partly aliased (module disabled).

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

- **Done (PR "UK calendar day for every business date").** Every `date.today()` / `datetime.now(UTC).date()` in
  `api/app` now goes through `core.time.uk_today()`: the six sites above plus `bookings/schemas.py`,
  `bookings/service_date_change.py`, `planner/service_plans.py` and `admin_insights/service.py`. The portal
  dashboard computes `uk_today()` once and `today=` is required. Services take an optional `now` (the test clock).
  `tests/guards/test_dates_use_uk_calendar_day.py` bans the direct forms.
- **Also done in the same PR.** Admin chart bounds and bucketing (`admin_insights`), the financials daily table
  and `paid_on_or_*` bounds, and the reminder job's "tomorrow" (`domain_maintenance.tomorrow_uk`) use London days.
  The guard also bans `.astimezone(UTC).date()`.
- **Done (PR "Cancellation refund tier counts UK days").** `bookings/domain_cancellation.days_before_event` now
  counts from `uk_date(now)`; `UTC_DAY_ALLOWED_FILES` is empty. No golden encodes the refund tier, all 1557 pass
  byte-exact. A cancel at 23:30 UTC in summer (00:30 BST) now lands in the next UK day's tier (pinned in
  `test_bookings_cancellation_domain.py`). Terms (`TermsOfServiceContent.tsx`, "counted from the date of
  cancellation to the first day of the event") does not name a timezone, so it is ambiguous but consistent;
  copy left unchanged for the solicitor pass.
- **Still UTC, follow-up.** The financials summary filters `date_from` / `date_to` (date-only strings) still mean midnight UTC
  (`repository_admin._as_datetime_bound`, frozen by acceptance), so a 23:30 UTC payment on the day before `date_from`
  is a London-day-of-`date_from` payment in the daily table but outside the summary total. Decide whether to freeze-break.

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
   - Delete the `limit: 200` wrappers (done).
   - Replace the dispute 50-second poll with realtime.
   - Remaining page-only KPIs: vendor "Next release" and admin referrals "Active creators".
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
