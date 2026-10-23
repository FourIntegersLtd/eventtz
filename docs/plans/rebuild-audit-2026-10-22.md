# Eventtz audit (2026-10-22) and remediation plan

## Context

`api/` and `web/` went live on 2026-10-16. The design-language rebuild then landed in a series of commits:
`5922d1b`, `b27b45c`, `04891c3`, `c21acdf` (385 files), `5b52a42`, `f7ba914` and `78e2e61`. Several of them
were written by Cursor without the owner agents, guards or reviewers. Three read-only audits were run, one
each for web design system, web architecture and api architecture, and the serious claims were then
re-checked by hand. Result: the rebuild added a **second design system** instead of unifying on one,
**weakened two freeze guards**, and introduced **a privacy leak, an unchecked image-fetch endpoint and a
prod-reachable design-diff hook**. Duplication and layering drift sit on top of that.

The aim is long-term maintainability under AGENTS.md: shared components, no hacks, subtract before adding,
and migrating callers before deleting.

### Decisions taken with the user
1. **Design system:** keep the canvas look (`eventtz.css`, `ez-*`). Rebuild the `components/ui` primitives
   so they render those classes, and have screens use the primitives. Nothing changes visually, and each
   look is defined in one place.
2. **Page size:** keep the new default of 25 on all lists, and record it as a deliberate contract change
   in an ADR. The edited test and golden stay as they are.
3. **API types:** implement ADR 0007 as written. That means adding `openapi-typescript` as a dev
   dependency (approved here), an `api:types` script and a CI drift check.
4. **Web layering:** name a small set of shared feature modules that any feature may import. Move generic
   pieces to `components/` or `lib/`, and enforce the rest with ESLint.

---

## Findings (ranked)

### Critical: fix first (correctness, security, guards)

| # | Finding | Evidence |
|---|---|---|
| C1 | **The frozen API contract was overwritten.** `78e2e61` regenerated `openapi.baseline.json` from the new app (178 → 199 ops; `/health` dropped). Because the baseline is now a copy of the app, `test_routes_match_baseline` can no longer fail. The 2 routes that commit added (`/media/upload-urls`, `/vendors/onboarding/ai/analyze-portfolio-image-url`) bypassed the allow-list. | `git show 78e2e61 --stat`; `api/tests/guards/test_routes_match_baseline.py` |
| C2 | **Vendors can find client emails through search.** `_booking_party_search_clause` matches `users.email ILIKE %q%` for vendors, even on unpaid bookings where the email is hidden (`domain.contact_visible`). | `api/app/features/bookings/repository.py:193-221` |
| C3 | **The AI image-URL endpoint is unchecked.** It checks only that the host is ours, so any vendor can submit another user's object key. It follows redirects, has no response size cap, does raw `httpx` I/O inside a service (no port), raises a misleading `ImageRequired` on fetch failure, and has no tests. | `api/app/features/vendors/service_ai.py:151-168` |
| C4 | **A design-diff hook ships to production.** `?payoutPreview=1` forces the payout modal open for any vendor, and pulls the 75 KB `vendorDesignFixtureHtml.ts` into the bundle. | `web/features/vendor/bookings/useVendorBookingsController.ts:23,88-105`, `web/features/vendor/design/*` |
| C5 | **The payments filter is wrong.** The client payments chip filter runs on one 25-row page, so page 2 and the total are wrong. The vendor "awaiting payout" KPI counts only the current page. | `web/features/client/payments/ClientPaymentsView.tsx:76`, `web/features/vendor/payments/VendorPaymentsView.tsx:143` |
| C6 | **Code branches on message text, not error `code`** (ADR 0004). | `useVendorBookingActions.ts:99` ("payout setup"), `features/auth/useUnifiedLogin.ts:51,55`, `vendor/onboarding/useOnboardingSteps.ts:186` |
| C7 | **The notification feed filters by English copy.** The "payments" topic matches `payout`/`payment`/`paid` in title and body instead of `kind`. | `api/app/features/notifications/service_feed.py:95-102` |

### High: structure

- **H1. There are two design systems.** About 3,900 `ez-*` usages sit across 148 files, while the
  primitives are barely used:

  | Primitive | Product importers |
  |---|---|
  | `Tabs`, `StatTile`, `Stepper`, `DescriptionList`, `CollapsibleSection` | 0 |
  | `PageHeader` | 1 |
  | `Card` | 9 |
  | `Badge` | 12 |

  - **Duplicate tokens.** `--success*` in `globals.css` has the same values as `--ez-success*` in
    `eventtz.css`. `neutral-*` Tailwind classes are used 1,367 times.
  - **The rule files contradict each other.** `scripts/design-diff/README.md` says to copy markup
    verbatim. `components/README.md` and `UI-CONVENTIONS.md` say to use the primitives.
  - **CSS and markup have drifted.** 56 `ez-*` classes are defined but unused. Some classes and variables
    are used but undefined: `ez-table-row--active`, `ez-topbar--icon`, `ez-availability*`,
    `ez-cal-block*`, `--ez-warning-ink`.
  - **About 150 inline `style={{}}`.** The worst is `vendor/onboarding/ui/WizardAside.tsx` with 36.
- **H2. Components are duplicated across features.**
  - Page headers have 4 copies: `ui/PageHeader`, `VendorEzPageHead`, `ClientEzPageHead`,
    `AdminEzPageHead`, plus raw `ez-pagehead` markup in 13 files.
  - Stat tiles have 4 copies: `ui/StatTile`, `AdminKpiCard`, `StatCard` in `vendorDetailsShared.tsx`, and
    `VendorMetricsStrip`.
  - Booking lists have 2 copies: `ClientBookingsEzList` and `VendorBookingsEzList` differ by about 40
    lines.
  - "Field / row" helpers have 6 or more copies, while `ui/DescriptionList` goes unused.
  - Text fields have 3 copies: `ui/TextField`, `ui/EzClearableInput`, and the onboarding
    `form-primitives.tsx` / `ez-form.tsx`.
  - Status badges have local `{label,className}` functions in 4 files, plus `AuditBadges`.
  - About 70 pills and alerts are hand-rolled (`bg-amber-50 border-amber-200`, …).
  - Client and vendor have twin views for settings, payments, messages, disputes, notifications, help and
    reviews, each pair styled differently.
- **H3. Web layering is broken.**
  - 9 `lib/` files import `features/` or `components/` (e.g. `lib/validation/supportMessage.ts` imports
    a constant from `features/chat/MessageComposer`).
  - `components/ui/EzFilterDateRangeModal.tsx` imports an admin feature, and has no importers itself.
  - There are 224 cross-feature imports, and vendor and admin import each other (the admin charts are
    used by vendor analytics).
  - No lint rule enforces any of this.
- **H4. The API types are hand-written and drift.** There are about 191 hand-written types across 44
  `lib/*Api.ts` files, against ADR 0007.
- **H5. Pagination is copied rather than shared.**
  - **api:**
    - `core/pagination.py` holds only a constant.
    - `Query(0, ge=0)` / `Query(DEFAULT_LIST_LIMIT, …le=…)` is copied about 30 times, with `le` caps of
      100, 200 or 500.
    - `total/offset/limit` is redefined in about 20 response schemas.
    - Every repository repeats count-then-page.
    - Paged queries order on a non-unique `created_at` with no tie-breaker, so pages can skip or repeat
      rows.
    - `%` and `_` from user input are not escaped in 16 `ilike` sites.
  - **"Server-side" lists that slice in memory:**
    - `notifications/service_feed.py:111-126` (500+200 rows)
    - `payments/service.py:346-359`
    - `bookings/service_admin_financials.py:164-177`
    - The portal dashboards
  - **web:**
    - About 23 list views each hand-roll offset, loading, error and reset.
    - Only bookings has a scaffold.
    - The guard test `lib/noClientListPagination.test.ts` is easy to evade.
    - Two deprecated `limit: 200` wrappers remain (`clientBookingsApi.ts:239`, `vendorBookingsApi.ts:191`).

### Medium: duplication and hygiene

- **M1. Formatters are duplicated.**
  - About 6 local `formatGbp` copies, plus `formatGbpLabel`, `formatVendorMoneyGbp`,
    `formatBookingMoneyLabel`, `formatPence` and `markets.formatMoney` (which is locale-dependent).
  - About 20 inline `£${x.toLocaleString(...)}`, some of which print "GBP …".
  - About 8 copies of the `dateStyle: medium` date formatter, ignoring `lib/dateFormat.ts`.
- **M2. The web duplicates business rules.**
  - `lib/bookingServiceFee.ts` hard-codes a 5% fee and the referral tiers with no parity test.
    `policyConstants.json` + `test_policy_constants.py` is the model to copy.
  - Fee and discount maths runs on float GBP.
- **M3. Twin modules on the api side.**
  - `disputes/router_client.py` ≡ `router_vendor.py`
  - `notifications/router_client.py` ≡ `router_vendor.py`
  - The client/vendor list-item builders in `bookings/service_queries.py`
- **M4. Duplicate error classes and codes** (`invalid_booking_id`, `no_fields_to_update`,
  `account_deleted`/`session_expired` defined twice). There are also uncoded `RuntimeError`
  (`vendors/service_profile.py:192`) and `ValueError` (`notifications/service.py:371`) raises in
  services.
- **M5. Dead code** (about 25 files):
  - Never wired in: `ui/EzFilterDateRangeModal`, `VendorBookingsDesignStatic`,
    `VendorAnalyticsDesignStatic`, `features/bookings/BookingDetailPanel.tsx`.
  - Superseded: the old help views `HelpCenterView`, `HelpCategoryView` and `HelpArticleView`.
  - Unused planner, landing and dashboard widgets, plus `admin/components/AdminFilterDateRange`,
    `AdminStackedBarChart` and `lib/useMediaQuery.ts`.
  - `MasterDetailLayout` is used only by chat, although the docs still say bookings uses it.
  - `VendorDashboardDesignStatic` is misnamed: it is the real dashboard.
  - A stray untracked file, `web/components/features`, contains just `lib-`.
- **M6. Repeated fetch patterns.** About 37 views repeat the `useEffect` + `setLoading` + error pattern.
  `BookingDisputeSection` polls every 50 s alongside the realtime bus.
- **M7. Minor rule breaks.**
  - `motion/react` is imported in `features/marketplace/MarketplaceFiltersBar.tsx`.
  - Admin charts hard-code hex colours (`#7c3aed`, `#e5e5e5`) instead of `--ez-chart-*`.
  - `violet-*` is used in `AuditBadges` and `DisputePartiesSummary`.
  - `domain_portal_dashboard.py` uses server-local time instead of Europe/London.
  - `scripts/seed_design_diff_vendor.py:141` commits inside `job_session()`.
  - The media README is stale (it still says images have no size cap and lists no upload-urls route).
  - `test_media_service.py` asserts a fresh fake is empty, which is always true.
  - The new pagination tests check shape only (`isinstance(total, int)`).
  - Stale docs: `docs/domain-rules.md:187` names `visibility.py`, which is gone.
- **M8. Money is float GBP across the api domains** (`pricing`, `referrals`, `domain_price_list`).
  Formatting also happens in the domains (`bookings/domain.py:167`, `service_payments.py:264`). This
  predates the rebuild and keeps golden parity, so it is **recorded but out of scope** here. It needs its
  own ADR plus a money-owner project.

### Missing guards (why these got through)

None of these is enforced today:
- the baseline being byte-equal to its last legitimate export
- `.env.example` matching settings
- web import boundaries
- cross-feature imports
- hand-rolled status colours
- `RuntimeError`/`ValueError` raised in features
- services importing adapters or doing raw HTTP
- hand-written `approval_status` filters (`referrals/service_client_codes.py:53,133`)
- `scripts/` sitting outside the SQL and commit guards
- `openapi.json` freshness
- the fee-constant parity test

Each fix below adds the guard that would have caught it, as `/fix-bug` requires.

---

## Plan

Each workstream is one PR-sized change. Each is routed to its owner through `/fix-bug` (for defects) or
`/build-feature` (for structural work). Each is proven with that owner's `verify-*` skill, then reviewed
by `quality-reviewer`. Anything touching money, auth, CI or guards also gets `reviewer` (opus) and
`/security-review`. The order puts the riskiest fixes first and makes the guards land before the large
refactors, so the refactors cannot regress.

### Phase 0: critical fixes (each a `/fix-bug`, small)

1. **Restore the contract** (platform-owner, + reviewer and /security-review because it is CI/guard work).
   - `git show 78e2e61~1:api/openapi.baseline.json > api/openapi.baseline.json`.
   - Add `POST /media/upload-urls` and `POST /vendors/onboarding/ai/analyze-portfolio-image-url` to
     `ADDITIVE_OPERATIONS`.
   - Add a guard asserting that the baseline's sha256 equals a pinned constant. This turns "never
     regenerate" into a test, with a meta-test.
   - Rename the stale meta-test `test_the_guard_only_exempts_the_realtime_prefix`.
2. **Booking search privacy** (bookings-owner + access review). Drop client email from the vendor-side
   search clause. Matching email only when `contact_unlocked` would itself leak which bookings are
   unlocked, so remove it. Add a failing HTTP test first: a vendor searches for a fragment of an unpaid
   client's email and gets 0 results.
3. **AI image URL** (vendors-owner, + /security-review).
   - Require the key to be under `users/<principal.id>/`, reusing the ownership check from
     `normalize_payload_fields`.
   - Move the fetch behind an `ObjectStorage.read_object(key, max_bytes)` port method in
     `core/ports.py`, implemented in `adapters/s3_storage.py` (S3 GetObject, no redirects), with a fake
     in `tests/support/fakes.py`.
   - Cap the read at `media_max_image_upload_bytes`.
   - Raise a new `ImageFetchFailed` with a stable code.
   - Add tests: another user's key is rejected, an oversize object is rejected, the happy path works.
   - Extend the guard so services may not import `app.adapters` or `httpx`.
4. **Remove the design-diff code from the product** (vendors-owner).
   - Delete `useDesignDiffPayoutPreview` and its use in `useVendorBookingsController.ts`.
   - Delete the dead `features/vendor/design/*` fixture files.
   - Move what `scripts/design-diff` still needs into the script's Playwright `setup` steps (click to open
     the modal) instead of query flags.
   - Update `scripts/design-diff/README.md`.
   - Rename `VendorDashboardDesignStatic` → `VendorDashboardEzView`.
5. **Payments filter** (money-owner, + reviewer).
   - Send the chip as a `payment_status`/status filter param to the existing booking-requests page
     endpoint. Add it to the api filter set and to the baseline allow-list only if it is a new query
     param (params aren't route-guarded).
   - Make the vendor "awaiting payout" count come from the server (`total` of a filtered query, or the
     vendor dashboard aggregate).
   - Widen `lib/noClientListPagination.test.ts` to flag `.filter(` and `.slice(` over `rows`/`items`
     state in list views.
6. **Error codes, not text** (access-, bookings- and vendors-owner).
   - Replace the 3 text matches with `getApiErrorCode` from `web/lib/api-errors.ts`. Add api codes where
     they are missing (payout-setup-required, email-unverified).
   - Add a web unit test that fails on `.includes(`/regex against `message`/`detail` inside catch
     blocks.
7. **Notification topic by kind** (comms-owner). Classify on `kind` through one domain map. Golden test
   per topic.
8. **Delete** the stray `web/components/features`.

### Phase 1: guards before refactors (platform-owner, `/build-feature`)

- **Web import boundaries** in `web/eslint.config.mjs` (`no-restricted-imports` / `import/no-restricted-paths`):
  - `lib/` may not import `components/`, `features/` or `app/`.
  - `components/` may import only `lib/`. Shells are an explicit allow-list: `PortalShell`,
    `AdminShell`, `RequireRole`, `CompliancePageShell`.
  - `features/X` may import `features/Y` only when Y is a named **shared feature**: `features/bookings`,
    `features/vendors/display`, `features/receipts`. Record the list in `web/components/README.md`.
  - Fix the current offenders as part of this change (moves only, no behaviour change):
    - `MESSAGE_MAX_LEN` → `lib/validation/supportMessage.ts`
    - `BookingTermsFields` type → `lib/`
    - `PortalRole` → `lib/portalRole.ts`
    - `ToastInput` type → `lib/`
    - the onboarding constants used by `lib/validation/money.ts` → `lib/`
    - admin charts + `chartUtils` + `PeriodDays` → `components/charts/`, recoloured with the
      `--ez-chart-*` tokens
    - delete `ui/EzFilterDateRangeModal`
- **API guards** in `api/tests/guards/`, each with a meta-test:
  - Feature code may not `raise RuntimeError/ValueError` outside `schemas*.py`/`domain_price_list.py`.
  - Services may not import adapters or httpx.
  - Hand-written `approval_status ==` filters are banned outside `vendors/` visibility helpers.
  - `.env.example` must have the same keys as `Settings`.
  - Extend the SQL and commit guards to `api/scripts/`, then fix `seed_design_diff_vendor.py:141`.
- **Design-token guard** (web unit test, extending `components/ui/designTokens.test.ts`):
  - no hex literals or `violet-|purple-` in `features/`
  - no `motion/react` outside `components/ui`
  - fix `MarketplaceFiltersBar`, `AuditBadges`, `DisputePartiesSummary`
- **Fee parity.** Move `BOOKING_SERVICE_FEE_PERCENT` and `REFERRAL_FEE_TIERS` into
  `web/lib/policyConstants.json` and extend `api/tests/unit/test_policy_constants.py`. This is
  money-owner work, so it also gets reviewer.

### Phase 2: one design system (platform-owner, then each area owner for its screens)

1. **Tokens.**
   - Make `eventtz.css` the only token source. Point `globals.css` semantic Tailwind tokens
     (`ink`, `line`, `surface-*`, `success*` …) at `var(--ez-*)` instead of duplicate hex values.
   - Make `ui/tokens.ts` (`TONE`, `SHADOW`, `RADIUS`) emit `ez-*` class names.
   - Delete `portal-shell/portalTheme.ts`, `admin-shell/adminTheme.ts` and `ui/sectionBlockTokens.ts`
     once their 18 importers have been migrated.
   - Wrap `eventtz.css` in `@layer components` so Tailwind utilities can override it without the shell
     workarounds in `PortalShell.tsx` and `AdminShell.tsx`.
2. **Primitives render the canvas classes.**
   - Rewrite these to output exactly the `ez-*` markup from the artboards, keeping their props:
     `Button`/`ButtonLink` (`ez-btn`), `Card` (`ez-card`), `Badge` (`ez-badge`), `Banner` (`ez-banner`),
     `Tabs` (`ez-tab`), `StatTile` (`ez-kpi`), `PageHeader` (`ez-pagehead`, with optional eyebrow),
     `DescriptionList` (`ez-dl`), `Stepper`, `TextField`/`Select`/`TextArea` (`ez-field`/`ez-input`,
     with `clearable` absorbing `EzClearableInput`), `EmptyState` (`ez-empty`), `TablePagination`.
   - Add a `DataTable` primitive over `ez-table` to replace `AdminTable` and the raw tables.
   - Each primitive gets a design-diff probe on `/internal/ui-kit` that compares it to its artboard.
3. **Collapse the duplicates onto the primitives.**
   - `Vendor/Client/AdminEzPageHead` → `PageHeader`
   - `AdminKpiCard`/`StatCard`/`VendorMetricsStrip` → `StatTile`
   - the six `Field` helpers → `DescriptionList`
   - onboarding `form-primitives.tsx`/`ez-form.tsx` → `TextField`
   - local status-class functions and `AuditBadges` → `Badge` + `components/badges/*`
   - hand-rolled amber/red/green panels → `Banner`
   - hand-rolled pills → `Badge`/`Chip`
   - Filters: the `Ez*` filter family wins; delete `AdminFilterBar`/`AdminFilterDateField`/
     `AdminFilterDateRange`, and move `AdminCommercePeriodFilter` onto `EzPeriodFilterButton`.
4. **Migrate screens area by area**, each owner on its own screens, one PR per area:
   - Replace raw `ez-*` markup with primitives.
   - Replace inline `style={{marginTop:…}}` with spacing utilities or `ez-stack` gaps.
   - Replace `neutral-*` with tokens.
   - Do the worst files first: `WizardAside.tsx`, `StepReview.tsx`, `StepPortfolio.tsx`,
     `VendorSettingsEzView.tsx`, `vendorDetailsShared.tsx`, `VendorBookingModal.tsx`, `HelpWidget.tsx`.
   - Prove each screen with the design-diff run printing `PASS`, because the look must not change.
5. **Merge client/vendor twins** where only labels differ:
   - `ClientBookingsEzList` + `VendorBookingsEzList` → one `features/bookings/BookingsEzList` with a
     `perspective` prop
   - the twin page heads, and the settings, payments and notifications view pairs onto shared section
     components
6. **Docs.**
   - One design rule in `web/components/README.md`: use the primitives, which render the canvas classes.
     A missing class is fixed in `eventtz.css` first.
   - Rewrite the "copy markup verbatim" step in `scripts/design-diff/README.md` to "compose primitives;
     prove with the diff".
   - Fix the stale `UI-CONVENTIONS.md` paths (`foundation/ui`) and the `MasterDetailLayout` claim.
   - Prune the 56 unused `ez-*` classes and define the missing ones.
   - Extend the guard: features may not use raw `ez-btn|ez-card|ez-badge|ez-banner|ez-pagehead|ez-kpi`
     class names, so only primitives emit them.

### Phase 3: shared lists, data and formatting

- **api pagination** (platform-owner kernel, then each slice owner):
  - In `core/pagination.py`, add `PageParams` (an `Annotated` dependency: `offset ≥ 0`,
    `limit 1..200`, default 25), a generic `Page[T]` response base, and a repository helper
    `paged(session, stmt, *, order_by, offset, limit) -> (rows, total)`. The helper always appends the
    primary key as a tie-breaker.
  - Add `escape_like()` and use it at all 16 `ilike` sites.
  - Migrate the ~30 routers, ~20 schemas and the repository count-then-page copies.
  - Push the in-memory lists into SQL: notification feed, payout history, admin financials daily.
- **ADR 0011, "List page size 25".** Records that frozen routes moved from 50 to 25 in `c21acdf`, which
  acceptance test and golden changed, and the `le` cap.
- **Merge the api twins:**
  - one disputes participant router factory parameterised by role
  - one notifications participant router factory parameterised by role
  - a shared list-item builder in `bookings/service_queries.py` with a role-specific field map
- **Errors.** Remove the duplicate codes and classes by moving the shared ones (`invalid_booking_id`,
  `no_fields_to_update`) into one owning slice or `core/errors.py`. Give the stray `RuntimeError`/
  `ValueError` raises their own `AppError`s.
- **Web lists.**
  - Add one `useServerList({ fetchPage, filters, pageSize })` hook in `lib/`, returning rows, total,
    offset, loading, error, reload and setFilters, with realtime refresh via `useRealtimeRefresh`.
  - Build `useParticipantBookingsScaffold` on it.
  - Migrate the ~23 hand-rolled list views and put `EzListFilterToolbar` on every list screen.
  - Delete the deprecated `limit: 200` wrappers.
  - Replace the dispute 50 s poll with the realtime bus.
- **Web API types (ADR 0007).**
  - Add the dev dependency `openapi-typescript` and the script `npm run api:types` →
    `web/lib/api-schema.d.ts`. Amend ADR 0007's path; `web/foundation/` no longer exists.
  - Add a CI step that fails if the generated output is out of date.
  - Add an api test that `openapi.json` equals `create_app().openapi()`.
  - Migrate the `lib/*Api.ts` hand-written types to generated ones slice by slice, starting with
    bookings, dashboards and payments.
  - Factor the shared `fetchPage` normaliser that `clientBookingsApi`/`vendorBookingsApi` both copy.
  - Fix AGENTS.md's "api-types.ts is hand-written" trap.
- **Formatting.**
  - Create one `lib/money.ts` with `formatGbp(amountGbp)` and `formatPence(pence)`, both `en-GB`/£ with
    a fixed locale.
  - Make `lib/dateFormat.ts` the only date formatter.
  - Delete the ~16 local copies and ~20 inline `toLocaleString` money sites.
  - Add a guard against `toLocaleString(` with a `currency` option or `"£"` template outside `lib/money.ts`.

### Phase 4: dead code and docs (subtract)

- Delete the orphaned files listed in M5, after confirming with grep and `npm run build` that nothing
  imports them.
- Fix the stale docs: `docs/domain-rules.md:187`, `api/app/features/media/README.md` (size caps,
  `/media/upload-urls`), the AGENTS.md traps for ADR 0007 and page size.
- Strengthen the shape-only tests:
  - `test_list_pagination.py` seeds limit+1 rows and asserts exact page contents, order and total, for
    `q` and the topic and read filters.
  - `test_media_service.py` asserts the presigned call was recorded.
  - Add an adapter test for `presigned_post`.
- Fix `domain_portal_dashboard.py` to take `today` from `core/time` (Europe/London).

### Out of scope (recorded for a later ADR)
- Moving api money domains from float GBP to integer pence (M8). It affects goldens, so it needs a
  money-owner project and its own ADR.

---

## Critical files

| Area | Files |
|---|---|
| Contract | `api/openapi.baseline.json`, `api/tests/guards/test_routes_match_baseline.py` |
| Bookings | `api/app/features/bookings/repository.py`, `api/app/features/bookings/service_queries.py` |
| Vendors and media | `api/app/features/vendors/service_ai.py`, `api/app/core/ports.py`, `api/app/adapters/s3_storage.py`, `api/tests/support/fakes.py` |
| Pagination | `api/app/core/pagination.py` |
| Notifications | `api/app/features/notifications/service_feed.py` |
| Design-diff leak | `web/features/vendor/bookings/useVendorBookingsController.ts`, `web/features/vendor/design/*` |
| Payments | `web/features/client/payments/ClientPaymentsView.tsx`, `web/features/vendor/payments/VendorPaymentsView.tsx` |
| Web lint | `web/eslint.config.mjs` |
| Design system | `web/design/canvas/project/eventtz.css`, `web/app/globals.css`, `web/components/ui/*` (tokens, Button, Card, Badge, Banner, PageHeader, StatTile, DescriptionList, TextField) |
| Web lib | `web/lib/api-errors.ts`, `web/lib/dateFormat.ts`, `web/lib/policyConstants.json`, new `web/lib/money.ts`, new `web/lib/useServerList.ts` |
| Docs | `web/components/README.md`, `web/UI-CONVENTIONS.md`, `web/scripts/design-diff/README.md`, `docs/adr/0007-*.md`, new `docs/adr/0011-list-page-size.md`, `AGENTS.md` |

## Verification

- **api:** `cd api && make db-up && make ci`. Check pytest's **exit code**, and confirm the `db` tests
  ran rather than skipped. Each new guard ships with a meta-test showing it fails on a planted violation.
  Each Phase 0 fix starts with a failing test (search leak, foreign key on AI URL, oversize object,
  payments chip on page 2, notification topic).
- **acceptance:** `cd acceptance && make serve` (in another shell), then `make test`, which must stay
  green. The freeze suite is the reference behaviour for every api change.
- **web:** `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"; cd web && npm test && npm run build`.
  `npm run lint` must show no new errors beyond the 45 inherited ones, and 0 boundary or token violations
  once Phase 1 lands.
- **Visual parity (Phase 2):** run `scripts/design-diff/run.mjs` against the live dev stack. Every screen
  in `screens.json` must print `PASS` before and after each migration PR. Also check `/internal/ui-kit`
  by eye at mobile and desktop widths.
- **Running app (AGENTS "Prove it works"):** use the `run` skill to sign in as the design-diff vendor and
  a seeded client and check these:
  - The payments filter on page 2 is correct.
  - Vendor search no longer finds a client by email before payment.
  - `?payoutPreview=1` does nothing.
  - The AI image check works on own uploads and rejects another user's key.
- **Per PR:** the owner's `verify-*` skill, then `quality-reviewer`. Contract, CI, guard, money and auth
  PRs also get `reviewer` (opus) and `/security-review`, then the user's review before merge.

---

## Status (2026-10-22)

**Phase 0 landed** (critical fixes C1 to C7, plus the stray file). Each went to its owner, was reviewed by
`quality-reviewer` and `reviewer` (opus), and has a test or guard that would have caught it:

| Fix | Guard or test added |
|---|---|
| C1 baseline | sha256 pin and a meta-test in `test_routes_match_baseline.py` |
| C2 search | `test_bookings_vendor_search.py`: email, digits and domain probes find nothing; the SQL friendly name is pinned to the Python one |
| C3 AI image | `Storage.read_object`, `check_upload_url` shared with profile save, and the `test_services_are_adapter_free` guard |
| C4 design-diff | Fixture code deleted; V13 reaches the payout modal by a click on a seeded booking |
| C5 payments | Server-side `payment_status` set; the Held count comes from the payout ledger via `GET /vendor/dashboard`; `noClientListPagination` now flags `.filter` over page rows |
| C6 error text | `noMessageTextBranching.test.ts` covers web features, lib and components |
| C7 feed | Topic by `kind` (`NOTICE_KIND_TOPICS`, every kind covered), and the feed filters and pages in SQL (it used to cut to 25 before filtering) |

**Pre-existing, found while verifying:**
- **The freeze suite is red on `main`.** `acceptance/` fails 9 tests both at HEAD and after Phase 0. Most get a
  `409` where the frozen backend returned `400` or `200` (vendor accept, checkout readiness). The likely cause is
  the Terms acceptance gate (`TermsNotAccepted`), which the frozen accounts never satisfy. One more,
  `test_vendor_payments_history_is_empty...`, fails on the pagination fields that `c21acdf` added.
  Owners: bookings and money.
- **Check live upload URLs before deploying.** Profile save now requires an upload key to *start* with
  `users/<id>/`. Before, `/users/<id>/` could appear anywhere in the path. Query the hosted vendors' payload
  image URLs for any on our bucket host whose path does not start with `/users/`.
- **Search does not cover the "Client" label.** Vendors search the name they see. Clients shown only as the
  fallback "Client", and closed accounts, are not matched by name.
- **A missing photo may show as 502.** Without `s3:ListBucket`, S3 reports a missing key as `AccessDenied`, so a
  missing photo surfaces as 502 instead of 404. Check the live IAM policy.
- **The vendor payments page loads the whole vendor dashboard** to read one count. Revisit when Phase 3 adds
  shared list aggregates.

**Next:** Phase 1 (guards before refactors).
