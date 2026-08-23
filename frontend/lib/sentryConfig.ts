import type { ErrorEvent, Event } from "@sentry/nextjs";

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

const SAFE_TO_IGNORE_PATTERN = /safe to ignore/i;

function getEventMessages(event: Event | ErrorEvent): string[] {
  const messages: string[] = [];
  if (event.message) messages.push(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) messages.push(exception.value);
    if (exception.type) messages.push(exception.type);
  }
  return messages;
}

/** Drop intentional console test errors (e.g. admin Sentry smoke tests). */
export function sentryBeforeSend<T extends Event | ErrorEvent>(
  event: T,
): T | null {
  if (getEventMessages(event).some((message) => SAFE_TO_IGNORE_PATTERN.test(message))) {
    return null;
  }
  return event;
}

export type SentrySharedInitOptions = {
  dsn: string;
  environment: string;
  sendDefaultPii: false;
  beforeSend: typeof sentryBeforeSend;
  tracesSampleRate: number;
};

/** Shared SDK options for client / server / edge. Null when DSN is unset (skip init). */
export function getSentrySharedInitOptions(): SentrySharedInitOptions | null {
  const dsn = getSentryDsn();
  if (!dsn) return null;
  return {
    dsn,
    environment: getSentryEnvironment(),
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
    tracesSampleRate: getSentryTracesSampleRate(),
  };
}
