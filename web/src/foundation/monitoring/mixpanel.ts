/**
 * Mixpanel wiring, behind an env var.
 *
 * `NEXT_PUBLIC_MIXPANEL_TOKEN` empty (the default) means tracking is off:
 * `track()` is a no-op. No `mixpanel-browser` package is installed yet —
 * see `sentry.ts` for the same trade-off and the approval note in the final
 * report.
 */

function token(): string {
  return process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim() ?? "";
}

export function isTrackingEnabled(): boolean {
  return token().length > 0;
}

/** Track a product event. A no-op until a Mixpanel token is configured. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!isTrackingEnabled()) return;
  void properties;
  // Intentionally left as a stub: wire `mixpanel.track(event, properties)`
  // here once `mixpanel-browser` is approved and installed.
  void event;
}
