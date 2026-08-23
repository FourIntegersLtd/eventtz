import * as Sentry from "@sentry/nextjs";
import { getSentrySharedInitOptions } from "./lib/sentryConfig";

const options = getSentrySharedInitOptions();
if (options) {
  Sentry.init(options);
}
