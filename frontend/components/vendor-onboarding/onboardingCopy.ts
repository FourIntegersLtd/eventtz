/** Conversational copy for vendor onboarding steps. */

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
    subtext: "Your working days and how many bookings you take per day.",
    daysHeadline: "Which days do you take bookings?",
    blockedHeadline: "Dates you're not available",
    blockedSubtext: "Optional.",
    maxBookingsHeadline: "Bookings per day",
  },
  6: {
    headline: "Show your best work",
    subtext: "Add photos, video, and social links.",
  },
  7: {
    headline: "Get paid",
    subtext: "Connect Stripe to receive payments.",
  },
  8: {
    headline: "Anything else?",
    subtext: "Certificates and insurance are optional.",
  },
  9: {
    headline: "Look good?",
    subtext: "Check everything before you submit.",
  },
} as const;
