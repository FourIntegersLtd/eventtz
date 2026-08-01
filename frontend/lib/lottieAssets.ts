/**
 * Local Lottie/dotLottie files under `public/animations/`.
 * Swap files freely - keep keys stable; prefer new filenames when replacing
 * artwork so browsers don't keep serving a cached wrong JSON.
 *
 * Which component to use? See **Motion & Lottie** decision guide in `cursor.md`.
 * Comments describe the **actual** artwork (verify when replacing files).
 */
export const LOTTIE_ASSETS = {
  /** Rocket + fireworks - launching soon / waitlist only. */
  launchingSoon: "/animations/launching-soon.json",
  /** Payment-style check burst - success confirms, paid, request sent. */
  successCheck: "/animations/success-check.json",
  /** Trophy - all caught up, celebration, onboarding finish. */
  allCaughtUp: "/animations/all-caught-up.json",
  /** Mail / paper-plane - empty lists, select prompts, no bookings. */
  emptyInbox: "/animations/empty-mail.json",
  /** Astronaut - 404 / not found. */
  notFound: "/animations/not-found.json",
  /** Geometric loading rings - branded page/panel loaders ONLY (never empty states). */
  loading: "/animations/loading-rings.json",
  /** Brain - AI planner generating. */
  aiThinking: "/animations/ai-thinking.json",
  /** Shield + check (LottieFiles) - payment safety, payout setup. */
  paymentSecure: "/animations/payment-secure-shield.json",
  /** Soft waiting loop - under review, waiting on confirm, dispute open. */
  pendingReview: "/animations/pending-review.json",
  /** Friendly mascot - auth welcome / soft empty hero (not for destructive confirms). */
  welcome: "/animations/welcome.json",
  /** Mail / paper-plane - empty chat thread, “read messages first” gate. */
  emptyMessages: "/animations/empty-chat.json",
  /** Search character + magnifier - filter / search no results. */
  searchNoResults: "/animations/search-empty.json",
  /** Failed X - payment/booking/sync errors and destructive confirms. */
  failure: "/animations/failure.json",
} as const;

export type LottieAssetKey = keyof typeof LOTTIE_ASSETS;

export function lottieSrc(key: LottieAssetKey): string {
  return LOTTIE_ASSETS[key];
}
