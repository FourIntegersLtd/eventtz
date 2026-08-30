import * as Sentry from "@sentry/nextjs";
import {
  getSentrySharedInitOptions,
  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
} from "./lib/sentryConfig";

const options = getSentrySharedInitOptions();
if (options) {
  Sentry.init({
    ...options,
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
