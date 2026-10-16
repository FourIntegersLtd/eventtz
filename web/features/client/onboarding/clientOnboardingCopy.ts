export const CLIENT_ONBOARDING_STEPS = [
  "welcome",
  "name",
  "browse",
  "book",
  "payments",
  "messages",
  "disputes",
  "finish",
] as const;

export type ClientOnboardingStep = (typeof CLIENT_ONBOARDING_STEPS)[number];

export type ClientOnboardingFeatureStep = {
  eyebrow: string;
  headline: string;
  body: string;
  highlights?: readonly string[];
};

export const CLIENT_ONBOARDING_COPY = {
  welcome: {
    eyebrow: "You're in",
    headline: "Welcome to Eventtz",
    body: "Find, book, and pay vendors in one place.",
    cta: "Show me around",
  },
  name: {
    eyebrow: "Quick intro",
    headline: "What should we call you?",
    body: "Vendors see this on your requests.",
    label: "Your name",
    placeholder: "e.g. Amina",
    cta: "Continue",
  },
  browse: {
    eyebrow: "Step 1",
    headline: "Find a vendor",
    body: "Search by service, location, and date.",
    highlights: ["Compare packages and reviews", "See prices upfront", "Save favourites"],
  },
  book: {
    eyebrow: "Step 2",
    headline: "Send a booking request",
    body: "Add your date and venue, then send a request. Pay once they confirm.",
    highlights: ["No payment until they accept", "Pick what you want", "Add venue on each request"],
  },
  payments: {
    eyebrow: "Step 3",
    headline: "Pay on Eventtz",
    body: "Pay securely after they accept.",
    highlights: ["Card payments", "Clear pricing", "Receipts in your dashboard"],
  },
  messages: {
    eyebrow: "Step 4",
    headline: "Message your vendor",
    body: "Chat from your booking.",
    highlights: ["One thread per booking", "Updates in one place", "History saved"],
  },
  disputes: {
    eyebrow: "Step 5",
    headline: "Need help?",
    body: "Open a dispute from your booking if something goes wrong.",
    highlights: ["Raise from any booking", "Evidence stays on the case", "We're here to help"],
  },
  finish: {
    eyebrow: "You're ready",
    headline: "Find your first vendor",
    body: "Bookings, messages, and payments are in your dashboard.",
    primaryCta: "Browse vendors",
    secondaryCta: "Go to dashboard",
  },
  skip: "Skip for now",
  back: "Back",
  continue: "Continue",
} as const;
