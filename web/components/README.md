# `web/components/`: shared UI and shells

Reusable UI and cross-cutting chrome only. **Product screens and domain widgets live in [`features/`](../features/)**; routes live in [`app/`](../app/README.md).

## Folder map

| Folder | Purpose |
|--------|---------|
| [`ui/`](ui/) | Generic primitives — Button, Modal, inputs, loading, motion, layout tokens |
| [`charts/`](charts/) | recharts wrappers (`EzAreaChart`, `EzBarChart`, `EzDonutChart`, ...) coloured with `--ez-chart-*` tokens |
| [`badges/`](badges/) | Domain-labeled status badges (booking, payment, vendor, dispute, admin) |
| [`auth/`](auth/) | `AuthProvider`, `Require*`, auth page shell, `ChangePasswordModal` |
| [`landing/`](landing/) | Public-site chrome: `LandingNav`, `LandingFooter`, `LandingSection`, section styles, nav and footer link data |
| [`portal-shell/`](portal-shell/) | Client + vendor portal chrome (`PortalShell`, nav, theme, `PortalFillHeight`) |
| [`admin-shell/`](admin-shell/) | Admin console chrome (`AdminShell`) |
| [`branding/`](branding/) | Logo and brand marks |
| [`compliances/`](compliances/) | Legal page shell + static policy content |
| [`media/`](media/) | Landing media wrappers |
| [`analytics/`](analytics/) | Mixpanel page-view tracking |

## Design rule

This is the one place the rule is written; `UI-CONVENTIONS.md` and `scripts/design-diff/README.md` point here.

The canvas look stays: `design/canvas/project/eventtz.css` (the `--ez-*` tokens and `ez-*` classes) is the
stylesheet, and `components/ui` blocks are the only code that renders it. Screens (`features/`, `app/`) compose the
blocks: `Card`, `Button`, `Badge`, `Banner`, `Tabs`, `Chip`, `PageHeader`, `StatTile`, `Avatar`, `DescriptionList`
(and `DescriptionRow` for rows inside a custom `dl`), `Stepper`. A screen does not write `ez-btn`, `ez-card`,
`ez-badge`, `ez-banner`, `ez-pagehead` or `ez-kpi` classes (guarded), nor inline `style={{}}` (by review) or `neutral-*` classes (guarded, here, in `features/` and in `lib/`). Colours,
shadows and radii come from the tokens in `app/globals.css`, surfaced by `ui/tokens.ts` (`TONE`, `SHADOW`, `RADIUS`,
`FORM_CONTROL`). Preview everything at `/internal/ui-kit`.

If a block lacks what the canvas draws, add it to the block (and to `eventtz.css` if the class is missing), not to the
screen. `ui/rawEzClassGuard.test.ts` fails on a raw class in `features/**` and `app/**`; the files it still allows are
listed there and only shrink (a stale entry fails). An `ez-*` class nothing in `web/` references (`.tsx`, `.ts`, `.css`,
canvas `.dc.html`) is deleted from `eventtz.css`; the `ez-badge--*`, `ez-banner--*`, `ez-icon-tile--*` and `ez-role--*`
families are built in template strings, so keep them whole.

Other shared pieces: `StatTile` (`compact` for dense strips), `TextArea` (`hideLabel`), `EzFilterDateField` (date filter),
`EzListFilterToolbar` (search and filters for any list) and `lib/useServerList.ts` (paged, filtered, searched
server lists; the bookings lists use it through `features/bookings/BookingsEzList`).

## Dependency rules

```text
app/        → features/, components/, lib/
features/X  → components/, lib/, features/X (own area), and the shared feature modules below
components/ → components/, lib/ only   (the shell allow-list below may also import features/)
lib/        → lib/ only                (never components/, features/ or app/)
```

Enforced by ESLint (`no-restricted-imports`, configured in [`eslint.boundaries.mjs`](../eslint.boundaries.mjs),
wired in `eslint.config.mjs`; `npm run lint` fails on a violation). `lib/eslintBoundaries.test.ts`
lints virtual files with the real config, so a config edit that disables a rule fails `npm test`.
A feature **area** is the first path segment under `features/` (`admin`, `client`, `vendor`, ...).

**Shared feature modules** (any feature may import these; keep the list short):

| Module | Why it is shared |
|--------|------------------|
| `features/bookings/{ActiveEventPrefillBanner,BookingCompletionBanner,BookingDateChangeCard,BookingDisputeSection,BookingPayoutPendingBanner,BookingPriceUpdateBanner,BookingPricingBreakdown,BookingTermsNotices,BookingsEzList,ClientFeeBreakdownSummary,MasterDetailLayout,MultiVendorPackagePicker,ParticipantDisputesListView,VendorBookingDetailEzPanel,VendorQuoteFormModal}` | Booking panels, banners and modals rendered by client, vendor, admin, chat and marketplace |
| `features/bookings/{bookingConfirmCopy,bookingListConstants,bookingPriceLabels,bookingTerms,bookingViewModel,cancellationPolicyCopy,eventDay,eventEnquirePrefill,groupBookingsByEvent,multiVendorPackageSelection,toBookingDetailViewModel,useEnquireEventFormState,useLaunchingSoonBookingGuard,useParticipantBookingsScaffold}` | Booking view models, terms, copy and hooks used across areas |
| `features/vendors/display` | Vendor listing presentation (browse cards, portfolio, pricing blocks) |
| `features/receipts/{PaymentsListSection,ReceiptActions}` | Receipt download and share buttons; the loading, error, empty and paging frame of the client and vendor payment lists |
| `features/landing/landingData` | Landing categories and copy, read by the marketplace category counts |
| `features/reviews/{BookingReviewPanel,ReviewCard,ReviewPhotoGallery,ReviewPhotoPicker,VendorReviewsEzView,reviewFormatters,useReviewsQuery}` | Review cards, panels and queries shown to client, vendor and admin |
| `features/chat/{ChatDrawer,ChatPortalView}` | Chat drawer and portal view |
| `features/dashboard/{AttentionFeedCard,BookingsCalendarCard,attentionFeedHelpers,attentionTypes}` | Attention feed and calendar cards of the client and vendor dashboards |
| `features/auth/authRouting` | `authRouting` helpers |
| `features/vendor/copilot` | AI co-pilot, hosted by the portal shell, help widget and chat |
| `features/help/helpContent` | Static help copy, also read by the co-pilot |
| `features/vendor/onboarding/serializeVendorPayload` | Vendor profile payload shape, used by admin review and settings |

`lib/eslintBoundariesLists.test.ts` fails when this table and `SHARED_FEATURE_MODULES` differ, or when an entry is
no longer imported across areas (delete it).

A few pages compose another area on purpose (`AREA_COMPOSES`): `landing` and `client` host
`marketplace`, `settings` hosts `client/onboarding`, `help` hosts `contact`.

**Shell allow-list** (`components/` files that may import `features/` widgets, never `app/`):
`portal-shell/PortalShell`, `admin-shell/AdminShell`, `auth/RequireRole`.

**Where a shared piece goes instead of a feature import:** generic UI → `components/ui/` (or
`components/charts/` for recharts wrappers, coloured by the `--ez-chart-1..5` tokens); constants,
types and pure logic → `lib/` (for example `lib/vendorOnboarding/`, `lib/portalRole.ts`).
Add a name to the shared list only for a real product module that several areas render.

## Shell wiring

| Portal | Shell | Where mounted |
|--------|-------|---------------|
| Client | `PortalShell` (`portal="client"`) | [`app/client/(portal)/layout.tsx`](../app/client/(portal)/layout.tsx) |
| Vendor | `PortalShell` (`portal="vendor"`) | [`app/vendor/(portal)/layout.tsx`](../app/vendor/(portal)/layout.tsx) |
| Admin | `AdminShell` via `AdminConsolePage` | Each [`app/admin/(portal)/`](../app/admin/(portal)/) page |

Shells may compose feature widgets (e.g. `HelpWidget`, notification bell) — that is intentional cross-cutting chrome, not product logic, and is why they are on the allow-list above.

## Theme tokens

Colours, radii and shadows are `--ez-*` tokens in `design/canvas/project/eventtz.css` (loaded in the `components` layer), re-exported to Tailwind by `app/globals.css`. Blocks in `ui/` emit `ez-*` classes; card surfaces come from `CARD_SURFACE` / `CARD_PADDING` in [`ui/tokens.ts`](ui/tokens.ts).

## Adding a new component

1. **Generic control** (no domain names) → `ui/`
2. **Domain status label** (used across portals) → `badges/`
3. **Portal or admin chrome** → `portal-shell/` or `admin-shell/`
4. **Single-feature widget** → `features/<domain>/`, not here

See [`AGENTS.md`](../../AGENTS.md) and [`UI-CONVENTIONS.md`](../UI-CONVENTIONS.md).
