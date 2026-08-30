/**
 * Local Lottie/dotLottie files under `public/animations/`.
 * Swap files freely - keep keys stable; prefer new filenames when replacing
 * artwork so browsers don't keep serving a cached wrong JSON.
 *
 * Which component to use? See **Motion & Lottie** decision guide in `cursor.md`.
 * Comments describe the **actual** artwork (verify when replacing files).
 */
export const LOTTIE_ASSETS = {
  /** Rocket + fireworks — completion moments (request sent, profile live, onboarding finish). */
  launchingSoon: "/animations/launching-soon.json",
  /** Payment-style check burst - success confirms, paid, request sent. */
  successCheck: "/animations/success-check.json",
  /** Trophy - all caught up, celebration, onboarding finish. */
  allCaughtUp: "/animations/all-caught-up.json",
  /** @deprecated Mail envelope - do not use; pick an EmptyState `variant` instead. */
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
  /** @deprecated Same envelope as emptyInbox - use EmptyState `variant="messages"`. */
  emptyMessages: "/animations/empty-chat.json",
  /** Search character + magnifier - filter / search no results. */
  searchNoResults: "/animations/search-empty.json",
  /** Failed X - payment/booking/sync errors and destructive confirms. */
  failure: "/animations/failure.json",
} as const;

export type LottieAssetKey = keyof typeof LOTTIE_ASSETS;

/** Empty-state illustrations only - never the branded loader or mail envelope catch-alls. */
export type EmptyLottieAssetKey = Exclude<
  LottieAssetKey,
  "loading" | "failure" | "emptyInbox" | "emptyMessages"
>;

export function lottieSrc(key: LottieAssetKey): string {
  return LOTTIE_ASSETS[key];
}
