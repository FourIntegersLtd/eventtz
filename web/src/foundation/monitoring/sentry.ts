/**
 * Sentry wiring, behind an env var.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` empty (the default, and every non-production
 * environment) means Sentry is off entirely: `init()` is a no-op and
 * `captureException` only logs to the console. No Sentry package is
 * installed yet — OSCE `platform-web` does not depend on one either, so
 * adding `@sentry/nextjs` needs the user's approval (see the final report).
 * This module is the single place that decision will be wired in.
 */

function dsn(): string {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";
}

export function isMonitoringEnabled(): boolean {
  return dsn().length > 0;
}

/** Call once, at app start. A no-op until a Sentry DSN is configured. */
export function initMonitoring(): void {
  if (!isMonitoringEnabled()) return;
  // Intentionally left as a stub: wire `Sentry.init({ dsn: dsn() })` here
  // once `@sentry/nextjs` is approved and installed.
}

/** Report an error to Sentry, or the console when monitoring is off. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!isMonitoringEnabled()) {
    console.error(error, context);
    return;
  }
}
