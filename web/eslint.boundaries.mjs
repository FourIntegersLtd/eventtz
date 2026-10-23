/**
 * Import-boundary rules for web/ (see components/README.md, "Dependency rules").
 *
 *   lib/        imports lib/ only
 *   components/ imports lib/ and components/ only (a short allow-list of shell files may also import features/)
 *   features/X  imports lib/, components/, its own area, and the named shared feature modules below
 *   app/        may import anything
 *
 * "Area" is the first path segment under features/ (admin, client, vendor, bookings, ...).
 * Enforced by the local `eventtz/import-boundary` rule, which also catches relative imports
 * (`../features/x`, resolved against the importing file) and dynamic `import()`;
 * web/lib/eslintBoundaries.test.ts proves the rules still fire.
 */
import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Feature modules every feature may import: named sub-paths (`area/path`), never a whole area.
 * Keep this short: a candidate that is generic UI or a constant belongs in components/ or lib/
 * instead. components/README.md repeats this list as a table; lib/eslintBoundariesLists.test.ts
 * fails when the two drift or an entry goes stale.
 */
export const SHARED_FEATURE_MODULES = [
  // bookings: view models, terms, copy, pricing breakdown, quote and detail panels
  "bookings/ActiveEventPrefillBanner",
  "bookings/BookingCompletionBanner",
  "bookings/BookingDateChangeCard",
  "bookings/BookingDisputeSection",
  "bookings/BookingPayoutPendingBanner",
  "bookings/BookingPriceUpdateBanner",
  "bookings/BookingPricingBreakdown",
  "bookings/BookingTermsNotices",
  "bookings/BookingsEzList",
  "bookings/ClientFeeBreakdownSummary",
  "bookings/MasterDetailLayout",
  "bookings/MultiVendorPackagePicker",
  "bookings/ParticipantDisputesListView",
  "bookings/VendorBookingDetailEzPanel",
  "bookings/VendorQuoteFormModal",
  "bookings/bookingConfirmCopy",
  "bookings/bookingListConstants",
  "bookings/bookingPriceLabels",
  "bookings/bookingTerms",
  "bookings/bookingViewModel",
  "bookings/cancellationPolicyCopy",
  "bookings/eventDay",
  "bookings/eventEnquirePrefill",
  "bookings/groupBookingsByEvent",
  "bookings/multiVendorPackageSelection",
  "bookings/toBookingDetailViewModel",
  "bookings/useEnquireEventFormState",
  "bookings/useLaunchingSoonBookingGuard",
  "bookings/useParticipantBookingsScaffold",
  "vendors/display", // vendor listing presentation (browse cards, pricing blocks)
  "receipts/ReceiptActions", // receipt download and share buttons
  "receipts/PaymentsListSection", // loading, error, empty and paging frame of the client and vendor payment lists
  "landing/landingData", // landing categories and copy, read by the marketplace category counts
  "reviews/BookingReviewPanel",
  "reviews/ReviewCard",
  "reviews/ReviewPhotoGallery",
  "reviews/ReviewPhotoPicker",
  "reviews/VendorReviewsEzView",
  "reviews/reviewFormatters",
  "reviews/useReviewsQuery",
  "chat/ChatDrawer",
  "chat/ChatPortalView",
  "dashboard/AttentionFeedCard",
  "dashboard/BookingsCalendarCard",
  "dashboard/attentionFeedHelpers",
  "dashboard/attentionTypes",
  "auth/authRouting",
  "vendor/copilot", // AI co-pilot, also hosted by the help widget and chat
  "help/helpContent", // static help copy, also read by the co-pilot
  "vendor/onboarding/serializeVendorPayload", // vendor profile payload shape, read by admin review and settings
];

/** Composition pages: an area that hosts another area's widgets (extra targets, same path syntax). */
export const AREA_COMPOSES = {
  landing: ["marketplace"], // the home page embeds marketplace search and vendor cards
  client: ["marketplace"], // the client browse route wraps the marketplace shell
  settings: ["client/onboarding"], // settings hosts the client onboarding section
  help: ["contact"], // the help hub embeds the contact form
};

/** Files in components/ that compose feature widgets on purpose (portal chrome, route guards). */
export const COMPONENT_FEATURE_ALLOW_LIST = [
  "components/portal-shell/PortalShell.tsx",
  "components/admin-shell/AdminShell.tsx",
  "components/auth/RequireRole.tsx",
];

const featureAreas = readdirSync(join(webRoot, "features"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/** Does `specifier` match a boundary pattern? Supports `base`, `base/**` and `base/*` only. */
function matchesPattern(pattern, specifier) {
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return specifier === base || specifier.startsWith(`${base}/`);
  }
  if (pattern.endsWith("/*")) {
    const base = pattern.slice(0, -2);
    return specifier.startsWith(`${base}/`) && !specifier.slice(base.length + 1).includes("/");
  }
  return specifier === pattern;
}

/** A relative specifier rewritten to its `@/` alias form (so one pattern list covers both); others unchanged. */
function toAliasSpecifier(specifier, importingFile) {
  if (!specifier.startsWith(".")) return specifier;
  const fromRoot = relative(webRoot, resolve(dirname(importingFile), specifier));
  if (fromRoot.startsWith("..")) return specifier;
  return `@/${fromRoot.split(sep).join("/")}`;
}

/**
 * Like `no-restricted-imports` with `patterns: [{ group, message }]`, but a relative import is
 * resolved against the importing file first, and `import()` and `export ... from` count too.
 */
const importBoundaryRule = {
  meta: { type: "problem", schema: [{ type: "object" }] },
  create(context) {
    const { patterns } = context.options[0];
    const check = (node) => {
      const source = node.source;
      if (!source || source.type !== "Literal" || typeof source.value !== "string") return;
      const specifier = toAliasSpecifier(source.value, context.filename);
      for (const { group, message } of patterns) {
        if (group.some((pattern) => matchesPattern(pattern, specifier))) {
          context.report({ node: source, message });
          return;
        }
      }
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};

/** Animation libraries stay inside components/ui (UI-CONVENTIONS.md): features use its primitives. */
const MOTION_IMPORT_RULE = {
  group: ["motion", "motion/*", "framer-motion"],
  message: "Import motion only inside components/ui. Use MotionReveal, Drawer, Modal or BottomSheet, or add a primitive there.",
};

/** Rule for components/ and components/ui alike: neither may reach into features/ or app/. */
const COMPONENT_BOUNDARY_RULE = {
  group: ["@/features/**", "@/app/**"],
  message: "components/ may import only lib/ and components/. Move the shared piece into lib/ or components/.",
};

const restrict = (group, message) => ({
  "eventtz/import-boundary": ["error", { patterns: [{ group, message }, MOTION_IMPORT_RULE] }],
});

/**
 * Forbidden import patterns under features/`relativeDir`. Gitignore-style negations cannot
 * re-include a child of an excluded folder, so a folder holding a shared sub-path is walked and
 * each of its other children is listed on its own.
 */
function forbiddenUnder(relativeDir, allowed) {
  const patterns = [];
  for (const entry of readdirSync(join(webRoot, "features", relativeDir), { withFileTypes: true })) {
    const modulePath = `${relativeDir}/${entry.name.replace(/\.(ts|tsx)$/, "")}`;
    if (allowed.includes(modulePath)) continue;
    if (entry.isDirectory() && allowed.some((shared) => shared.startsWith(`${modulePath}/`))) {
      patterns.push(...forbiddenUnder(modulePath, allowed));
    } else {
      patterns.push(`@/features/${modulePath}`, `@/features/${modulePath}/**`);
    }
  }
  return patterns;
}

/** Patterns forbidding every feature module outside `area`, its composes list and the shared list. */
export function featurePatterns(area) {
  const allowed = [...SHARED_FEATURE_MODULES, ...(AREA_COMPOSES[area] ?? [])];
  return featureAreas
    .filter((other) => other !== area && !allowed.includes(other))
    .flatMap((other) =>
      allowed.some((entry) => entry.startsWith(`${other}/`))
        ? forbiddenUnder(other, allowed)
        : [`@/features/${other}`, `@/features/${other}/**`],
    );
}

export const boundaryConfigs = [
  { plugins: { eventtz: { rules: { "import-boundary": importBoundaryRule } } } },
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: restrict(
      ["@/components/**", "@/features/**", "@/app/**"],
      "lib/ may not import components/, features/ or app/. Move the shared piece down into lib/.",
    ),
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    ignores: COMPONENT_FEATURE_ALLOW_LIST,
    rules: restrict(COMPONENT_BOUNDARY_RULE.group, COMPONENT_BOUNDARY_RULE.message),
  },
  {
    // components/ui is where motion/react lives: same boundary, minus the motion rule.
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: { "eventtz/import-boundary": ["error", { patterns: [COMPONENT_BOUNDARY_RULE] }] },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: { "eventtz/import-boundary": ["error", { patterns: [MOTION_IMPORT_RULE] }] },
  },
  {
    files: COMPONENT_FEATURE_ALLOW_LIST,
    rules: restrict(["@/app/**"], "components/ may not import app/."),
  },
  ...featureAreas.map((area) => ({
    files: [`features/${area}/**/*.{ts,tsx}`],
    rules: restrict(
      featurePatterns(area),
      `features/${area} may import only its own area and the shared feature modules listed in eslint.boundaries.mjs. Move generic pieces to components/ or lib/.`,
    ),
  })),
];
