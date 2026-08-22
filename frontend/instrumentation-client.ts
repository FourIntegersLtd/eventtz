import * as Sentry from "@sentry/nextjs";
import {
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
  sentryBeforeSend,
  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
} from "./lib/sentryConfig";

const dsn = getSentryDsn();
if (dsn) {
  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
    tracesSampleRate: getSentryTracesSampleRate(),
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    replaysSessionSampleRate: SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
