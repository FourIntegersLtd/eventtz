/**
 * User-facing planner copy, character for character from the baseline
 * (`frontend/features/client/planner/plannerCopy.ts` and `frontend/lib/planner-messages.ts`).
 */

export const SIMPLE_INTENT = "This looks like a simple vendor search. Try Browse instead.";

export const PLAN_BUILD_FAILED =
  "We could not build a plan from that description. Try adding the event type and city.";

export const PLAN_NOT_FOUND = "Plan not found.";

export const PLAN_ARCHIVED = "That plan is archived.";

export const NO_MORE_ALTERNATIVES = "No more alternatives for this category.";

export const PLAN_LOAD_FAILED = "Could not load this plan.";

export const REPLACE_FAILED = "Could not replace this recommendation.";

export const BOOK_NOW_FAILED = "Could not start booking. Try again.";

export const BROWSE_HANDOFF_FAILED = "Could not open marketplace.";

export const PLANNER_COPY = {
  pageTitle: "Plan my celebration",
  heroEyebrow: "AI Event Planner",
  heroHeadline: "Eventtz",
  heroSupport: "Describe your celebration once - we’ll assemble vendors, a budget, and next steps.",
  promptPlaceholder:
    "Help me plan my 30th birthday in London for about 120 guests with a budget of £5,000.",
  submitLabel: "Plan my event",
  loadingLabels: [
    "Understanding your celebration…",
    "Searching the marketplace…",
    "Ranking vendors…",
    "Building your budget…",
  ],
  simpleIntentHint: SIMPLE_INTENT,
  browseCta: "Browse vendors",
  emptyPlans: "No saved plans yet. Describe a celebration above to get started.",
  replaceLabel: "Replace",
  viewProfileLabel: "View profile",
  bookNowLabel: "Book now",
  browseRecommendationsLabel: "Browse these vendors",
  browseRecommendationsHint:
    "Continue in the marketplace to pick packages and message vendors - the same flow as browsing without AI.",
  priceOnRequest: "Price on request",
  unavailable: "No longer available - try Replace",
  overBudget: "Estimated total is over your budget",
  currencyAssumed: "Budget amounts shown in GBP.",
  invalidDate: "The date in your prompt looks past or invalid - confirm dates when you enquire.",
  emptyNeedFallback: "No vendors found for this category yet.",
  marketplacePrompt: "Prefer browsing?",
  marketplaceLink: "Open the marketplace",
  recentPlansHeading: "Your recent plans",
  recommendedHeading: "Recommended vendors",
  alternativesHeading: "Alternatives",
  budgetHeading: "Budget breakdown",
  budgetHowEstimated: "How we estimated this",
  optionalMark: "optional",
  promptLabel: "Describe your celebration",
} as const;
