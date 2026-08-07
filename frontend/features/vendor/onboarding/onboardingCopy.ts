/** Conversational copy for vendor onboarding steps. */

import { MIN_PORTFOLIO_IMAGES } from "./constants";

export const STEP_COPY = {
  1: {
    lead: "Let's get started",
    headline: "What should we call you?",
    subtext: "Clients see these after booking.",
  },
  2: {
    headline: "What's your business called?",
    subtext: "Who you are and what events you serve.",
    businessNameSupporting: "Must be unique.",
    servicesHeadline: "What services do you offer?",
    servicesSubtext: "Pick your main service.",
    eventTypesHeadline: "Which events do you work on?",
  },
  3: {
    headline: "Where are you based?",
    subtext: "So clients can find you nearby.",
    deliveryHeadline: "How do you deliver your service?",
    deliverySubtext: "Select all that apply.",
    radiusHeadline: "How far can you travel or deliver?",
    policyHeadline: "Travel or delivery fees",
    policySubtext: "Pick what fits how you charge.",
  },
  4: {
    headline: "How do you price your work?",
    subtext: "Add packages so clients can compare.",
    fixedRatesHeadline: "Hourly or daily rates?",
    packagesHeadline: "What packages do you offer?",
    bookingHeadline: "Any discounts?",
  },
  5: {
    headline: "When are you available?",
    subtext: "Choose your working days and how many bookings you can take each day.",
    daysHeadline: "Which days do you take bookings?",
    blockedHeadline: "Dates you're not available",
    blockedSubtext: "Optional.",
    maxBookingsHeadline: "Bookings per day",
  },
  6: {
    headline: "Show your best work",
    subtext: `Upload at least ${MIN_PORTFOLIO_IMAGES} photos so clients can see your work.`,
  },
  7: {
    headline: "Anything else?",
    subtext: "Certificates and insurance are optional.",
  },
  8: {
    headline: "Look good?",
    subtext: "Check everything before you submit.",
  },
} as const;

/** Shown to submitted vendors who still need portfolio photos before admin approval. */
export function portfolioApprovalBlockedCopy(photoCount: number) {
  const remaining = Math.max(0, MIN_PORTFOLIO_IMAGES - photoCount);
  return {
    bannerTitle: "Almost there — please add your portfolio photos",
    bannerBody: `Thank you for submitting your profile. Before we can finish our review, please upload at least ${MIN_PORTFOLIO_IMAGES} portfolio photos. You have ${photoCount} of ${MIN_PORTFOLIO_IMAGES} so far${
      remaining > 0 ? ` — just ${remaining} more to go` : ""
    }.`,
    submittedHeading: "One more step before approval",
    submittedBody: `Thanks for submitting — we're nearly ready to review your profile. Please add at least ${MIN_PORTFOLIO_IMAGES} portfolio photos so we can approve you. You currently have ${photoCount} of ${MIN_PORTFOLIO_IMAGES}.`,
    cardTitle: "Please add your portfolio photos",
    cardBody: `To approve your profile, we need at least ${MIN_PORTFOLIO_IMAGES} photos of your work. Please add ${remaining > 0 ? remaining : MIN_PORTFOLIO_IMAGES} more when you can — it only takes a few minutes.`,
    ctaLabel: "Add portfolio photos",
    checkStatusHint: "Once your photos are uploaded, we'll be able to continue with your review.",
  };
}
