/**
 * Local Lottie/dotLottie files under `public/animations/`.
 * Swap files freely — keep keys/paths stable so features don't hardcode URLs.
 *
 * Which component to use? See **Motion & Lottie** decision guide in `cursor.md`.
 */
export const LOTTIE_ASSETS = {
  /** Rocket — launching soon, waitlist, pre-launch booking guard. */
  launchingSoon: "/animations/launching-soon.json",
  /** Checkmark burst — success, confirmation, payment complete. */
  successCheck: "/animations/success-check.json",
  /** Trophy / celebration — all caught up, onboarding complete. */
  allCaughtUp: "/animations/all-caught-up.json",
  /** Compact loop — generic empty inbox / select-item prompts. */
  emptyInbox: "/animations/empty-inbox.json",
  /** Astronaut — 404 / not found. */
  notFound: "/animations/not-found.json",
  /** Branded loader — page/panel loading shells. */
  loading: "/animations/loading.json",
  /** Rocket — AI planner thinking / generating a plan. */
  aiThinking: "/animations/ai-thinking.json",
  /** Shield / registered — payment safety, payout setup. */
  paymentSecure: "/animations/payment-secure.json",
  /** Hourglass-style — profile under review, pending states. */
  pendingReview: "/animations/pending-review.json",
  /** Friendly intro — welcome modals, auth accent. */
  welcome: "/animations/welcome.json",
  /** First message / empty thread. */
  emptyMessages: "/animations/empty-messages.json",
  /** Search / filter no results, empty marketplace. */
  searchNoResults: "/animations/search-no-results.json",
  /** Payment failed, booking declined, checkout cancelled, sync errors. */
  failure: "/animations/failure.json",
} as const;

export type LottieAssetKey = keyof typeof LOTTIE_ASSETS;

export function lottieSrc(key: LottieAssetKey): string {
  return LOTTIE_ASSETS[key];
}
