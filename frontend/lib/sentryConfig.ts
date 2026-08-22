/**
 * Shared Sentry env helpers. Empty DSN = SDK stays a no-op.
 * NEXT_PUBLIC_SENTRY_DSN is used in the browser; SENTRY_DSN is a server-only fallback.
 */

export function getSentryDsn(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim() ||
    ""
  );
}

export function getSentryEnvironment(): string {
  const vercel =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim();
  if (vercel) return vercel;
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function getSentryTracesSampleRate(): number {
  return process.env.NODE_ENV === "production" ? 0.1 : 1;
}

/** Low background capture; errors always get a replay. */
export const SENTRY_REPLAYS_SESSION_SAMPLE_RATE = 0.05;
export const SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE = 1;
