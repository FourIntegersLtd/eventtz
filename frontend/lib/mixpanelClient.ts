/**
 * Browser Mixpanel client (OSCE Guide pattern).
 * No-ops when `NEXT_PUBLIC_MIXPANEL_TOKEN` is unset — safe for local/dev.
 *
 * Local debugging: set NEXT_PUBLIC_MIXPANEL_DEBUG=true (or leave unset in
 * development) to log [mixpanel] lines and enable the SDK debug flag.
 */

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim() || "";
const MIXPANEL_API_HOST = process.env.NEXT_PUBLIC_MIXPANEL_API_HOST?.trim() || "";
const IS_DEV = process.env.NODE_ENV === "development";
const DEBUG =
  process.env.NEXT_PUBLIC_MIXPANEL_DEBUG === "true" ||
  (IS_DEV && process.env.NEXT_PUBLIC_MIXPANEL_DEBUG !== "false");

export type MixpanelProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type MixpanelUserProperties = {
  email?: string | null;
  user_type?: string | null;
  admin_role?: string | null;
};

let initialized = false;

function enabled(): boolean {
  return Boolean(MIXPANEL_TOKEN);
}

function tokenHint(): string {
  if (!MIXPANEL_TOKEN) return "(missing)";
  if (MIXPANEL_TOKEN.length <= 8) return "(short?)";
  return `${MIXPANEL_TOKEN.slice(0, 4)}…${MIXPANEL_TOKEN.slice(-4)}`;
}

function log(...args: unknown[]): void {
  if (!DEBUG) return;
  console.log("[mixpanel]", ...args);
}

function warn(...args: unknown[]): void {
  if (!DEBUG) return;
  console.warn("[mixpanel]", ...args);
}

/** Call once on app mount (client). */
export function initMixpanel(): void {
  if (typeof window === "undefined") {
    log("init skipped (server)");
    return;
  }
  if (!enabled()) {
    warn(
      "init skipped — NEXT_PUBLIC_MIXPANEL_TOKEN is empty. Add it to frontend/.env and restart `npm run dev`.",
    );
    return;
  }
  if (initialized) {
    log("init skipped (already initialized)", { token: tokenHint() });
    return;
  }

  const initOpts: Record<string, unknown> = {
    track_pageview: false,
    persistence: "localStorage",
    debug: DEBUG,
    // Makes local testing show up faster in Live View
    batch_requests: !IS_DEV,
  };
  if (MIXPANEL_API_HOST) {
    initOpts.api_host = MIXPANEL_API_HOST;
  }

  try {
    mixpanel.init(MIXPANEL_TOKEN, initOpts);
    initialized = true;
    log("initialized", {
      token: tokenHint(),
      debug: DEBUG,
      api_host: MIXPANEL_API_HOST || "default (api.mixpanel.com)",
      distinct_id: mixpanel.get_distinct_id?.() ?? "(unknown)",
    });
  } catch (err) {
    console.error("[mixpanel] init failed", err);
  }
}

export function identifyMixpanelUser(
  userId: string,
  userProperties?: MixpanelUserProperties,
): void {
  if (!enabled()) {
    log("identify skipped (no token)", { userId });
    return;
  }
  if (!userId) {
    log("identify skipped (empty userId)");
    return;
  }
  if (!initialized) initMixpanel();
  mixpanel.identify(userId);
  log("identify", { userId, props: userProperties ?? null });
  if (userProperties) {
    const people: Record<string, string | Date> = {
      $last_seen: new Date(),
    };
    if (userProperties.email) people.$email = userProperties.email;
    if (userProperties.user_type) people.user_type = userProperties.user_type;
    if (userProperties.admin_role) people.admin_role = userProperties.admin_role;
    mixpanel.people.set(people);
    log("people.set", people);
  }
}

/** Clear distinct id on sign-out so the next visitor is not merged. */
export function resetMixpanel(): void {
  if (!enabled() || !initialized) {
    log("reset skipped", { enabled: enabled(), initialized });
    return;
  }
  mixpanel.reset();
  log("reset");
}

export function trackMixpanelEvent(
  eventName: string,
  properties?: MixpanelProperties,
): void {
  if (!enabled()) {
    log("track skipped (no token)", { eventName });
    return;
  }
  if (!initialized) initMixpanel();
  const cleaned: Record<string, string | number | boolean> = {};
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value === null || value === undefined) continue;
      cleaned[key] = value;
    }
  }
  mixpanel.track(eventName, cleaned);
  log("track", eventName, cleaned, {
    distinct_id: mixpanel.get_distinct_id?.() ?? "(unknown)",
  });
}

/** Manual page view (App Router has no automatic Mixpanel pageviews). */
export function trackMixpanelPageView(path: string): void {
  trackMixpanelEvent("page_viewed", { path });
}
