import { SIMPLE_INTENT } from "@/lib/planner-messages";

export const PLANNER_COPY = {
  pageTitle: "Plan my celebration",
  heroEyebrow: "AI event planner",
  heroHeadline: "Plan my celebration",
  heroSupport:
    "Describe your celebration once and we will assemble vendors, a budget and next steps.",
  generateHint: "Takes about 20 seconds",
  savedPlansTitle: "Saved plans",
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
  emptyPlans: "No saved plans yet.",
  sendEnquiryLabel: "Send enquiry to selected",
  sendEnquiryHint: "Free to enquire. Pay only when you accept a quote.",
  backToPlanner: "Back to planner",
  editDetails: "Edit details",
  estimatedBudget: "Estimated budget",
  recommendedVendors: "Recommended vendors",
  replaceLabel: "Replace",
  viewProfileLabel: "View profile",
  bookNowLabel: "Book now",
  browseRecommendationsLabel: "Browse these vendors",
  browseRecommendationsHint:
    "Continue in the marketplace to pick packages and message vendors - the same flow as browsing without AI.",
  priceOnRequest: "Price on request",
  unavailable: "No longer available - try Replace",
  overBudget: "Estimated total is over your budget",
} as const;
