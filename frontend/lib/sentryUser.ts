/**
 * Attach a non-PII user id to Sentry events. No-ops when the DSN is unset.
 */

import * as Sentry from "@sentry/nextjs";
import { getSentryDsn } from "@/lib/sentryConfig";

export function identifySentryUser(
  userId: string,
  userType?: string | null,
): void {
  if (!getSentryDsn() || !userId) return;
  Sentry.setUser({ id: userId });
  if (userType) {
    Sentry.setTag("user_type", userType);
  }
}

export function resetSentryUser(): void {
  if (!getSentryDsn()) return;
  Sentry.setUser(null);
}
