import * as Sentry from "@sentry/nextjs";
import {
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
} from "./lib/sentryConfig";

const dsn = getSentryDsn();
if (dsn) {
  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    sendDefaultPii: false,
    tracesSampleRate: getSentryTracesSampleRate(),
  });
}
