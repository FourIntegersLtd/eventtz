import type { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/backend-url";

/**
 * Where the signed-in session lives now that the frontend talks to `api/`.
 *
 * The baseline backend set its own `httpOnly` cookies. `api/` sets none: it
 * returns a bare token pair in the JSON body and expects
 * `Authorization: Bearer` on every call (ADR 0003). This Next server keeps
 * that pair in `httpOnly` cookies on its own origin and adds the header when
 * it forwards a call (`app/api/v1/[...path]/route.ts`), so the browser code
 * copied from `frontend/` works unchanged and no token ever reaches
 * client-side JavaScript.
 */

/** The refresh token. Only this server ever reads it. */
export const REFRESH_COOKIE = "eventtz_rt";
/** The current access token, sent upstream as the Bearer header. */
export const ACCESS_COOKIE = "eventtz_at";

/**
 * How long the browser keeps the cookies. `api/` revokes the refresh token on
 * its own schedule; this is only a ceiling on how long an unused one lingers.
 */
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * How long a finished refresh is remembered for the token it spent.
 *
 * `api/`'s refresh tokens are single-use, and spending one twice revokes the
 * whole sign-in as theft. Two tabs that hit a 401 together both post the same
 * old token; the second gets the first one's new pair from here instead.
 * In-process only, so this assumes one `web` replica.
 */
const REFRESH_REUSE_WINDOW_MS = 30_000;

/** A token pair as `api/` returns it under `session`. */
export interface PlatformSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
}

/** What `api/` answered to `POST /auth/refresh`, kept whole so every waiter can replay it. */
export interface RefreshOutcome {
  status: number;
  body: Record<string, unknown> | null;
}

const refreshesInFlight = new Map<string, Promise<RefreshOutcome>>();

/** The stored access and refresh tokens, if any. */
export function readSession(request: NextRequest): { accessToken?: string; refreshToken?: string } {
  return {
    accessToken: request.cookies.get(ACCESS_COOKIE)?.value || undefined,
    refreshToken: request.cookies.get(REFRESH_COOKIE)?.value || undefined,
  };
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Local development is plain http, where a `Secure` cookie is silently dropped.
    secure: process.env.NODE_ENV === "production",
    // `Lax`: emailed verify and reset links are top-level arrivals from another site.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Store a pair `api/` just issued. */
export function writeSession(response: NextResponse, session: PlatformSession): void {
  response.cookies.set(ACCESS_COOKIE, session.access_token, cookieOptions(COOKIE_MAX_AGE_SECONDS));
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, cookieOptions(COOKIE_MAX_AGE_SECONDS));
}

/** Forget the session in this browser. */
export function clearSession(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
}

/** True when `value` looks like the `session` object `api/` returns. */
export function isPlatformSession(value: unknown): value is PlatformSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.access_token === "string" && typeof candidate.refresh_token === "string";
}

/**
 * Exchange `refreshToken` at `api/`, once per token however many callers ask.
 *
 * See `REFRESH_REUSE_WINDOW_MS` for why a second caller must not spend it again.
 */
export function refreshOnce(refreshToken: string, forwardedHeaders: HeadersInit): Promise<RefreshOutcome> {
  const pending = refreshesInFlight.get(refreshToken);
  if (pending) return pending;

  const exchange = (async (): Promise<RefreshOutcome> => {
    const headers = new Headers(forwardedHeaders);
    headers.set("content-type", "application/json");
    const upstream = await fetch(`${getBackendBaseUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    const body = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: upstream.status, body };
  })();

  refreshesInFlight.set(refreshToken, exchange);
  // Forget the outcome after the window, and at once if the exchange itself
  // threw (api/ unreachable), so the next attempt can try again.
  exchange.then(
    () => setTimeout(() => refreshesInFlight.delete(refreshToken), REFRESH_REUSE_WINDOW_MS),
    () => refreshesInFlight.delete(refreshToken),
  );
  return exchange;
}

/** Test-only: forget remembered refreshes between tests. */
export function resetRefreshMemoryForTests(): void {
  refreshesInFlight.clear();
}
