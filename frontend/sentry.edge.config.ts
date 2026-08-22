import * as Sentry from "@sentry/nextjs";
import {
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  sentryBeforeSend,
} from "./lib/sentryConfig";

const dsn = getSentryDsn();
if (dsn) {
  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
    tracesSampleRate: getSentryTracesSampleRate(),
  });
}
