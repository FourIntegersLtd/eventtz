/** Conversational copy for vendor onboarding steps (QuietNight-style framing). */

export const STEP_COPY = {
  1: {
    lead: "Let's get started",
    headline: "What should we call you?",
    subtext:
      "Your name and phone help clients reach you after they book. We only show this on confirmed bookings.",
  },
  2: {
    headline: "What's your business called?",
    subtext: "Tell us who you are and what kind of events you serve.",
    businessNameSupporting:
      "Must be unique — we check when you leave this field.",
    servicesHeadline: "What services do you offer?",
    servicesSubtext: "Select all that apply. Choose Other if you don't fit these categories.",
    eventTypesHeadline: "Which events do you work on?",
  },
  3: {
    headline: "Where are you based?",
    subtext: "Your location helps us match you with nearby clients and set travel expectations.",
    deliveryHeadline: "How do you deliver your service?",
    deliverySubtext: "Select all that apply.",
    radiusHeadline: "How far can you travel or deliver?",
    policyHeadline: "What's your default travel or delivery rule?",
    policySubtext:
      "We've pre-selected the most common option — change it if it doesn't match how you handle fees.",
  },
  4: {
    headline: "How do you price your work?",
    subtext:
      "Add packages with pricing and details so clients can compare offers.",
    fixedRatesHeadline: "Do you charge hourly or daily rates?",
    packagesHeadline: "What packages do you offer?",
    bookingHeadline: "Any discounts?",
  },
  5: {
    headline: "When are you available?",
    subtext:
      "Set the days you take bookings and how many events you can handle in a day.",
    daysHeadline: "Which days do you usually accept bookings?",
    blockedHeadline: "Any dates you're not available?",
    blockedSubtext: "Optional — add holidays or days off.",
    maxBookingsHeadline: "How many bookings can you take per day?",
  },
  6: {
    headline: "Show clients your best work",
    subtext:
      "Photos and video help clients trust your style. Add portfolio images, a showreel, and social links.",
  },
  7: {
    headline: "Ready to get paid?",
    subtext:
      "Connect Stripe so you can receive payouts when clients pay for bookings through Eventtz.",
  },
  8: {
    headline: "Anything else we should know?",
    subtext:
      "Upload certificates or insurance if relevant. All fields here are optional unless noted.",
  },
  9: {
    headline: "Does everything look right?",
    subtext: "Review your profile below. You can edit any section before you submit.",
  },
} as const;
