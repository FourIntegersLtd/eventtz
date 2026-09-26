import type { NextRequest, NextResponse } from "next/server";

/**
 * Where the platform session actually lives: `httpOnly` cookies on `web`'s
 * own origin, written by the route handlers under `/api/session`. Ported
 * from OSCE `platform-web`.
 *
 * The refresh token never reaches client-side JavaScript. It goes in an
 * `httpOnly` cookie that scripts cannot read, and only the Next server ever
 * spends it (`/api/session/token`). The access token is cached in memory on
 * the client (`auth.ts`) and lives a short time; refreshing it is what an
 * XSS could still do, but it cannot renew itself indefinitely the way a
 * stolen `localStorage` refresh token could.
 *
 * `api/`'s identity slice sets no cookies of its own (`api/app/features/identity/`):
 * it issues bare token pairs, and `web` is the only side that wraps them in cookies.
 */

/** The refresh token. Never leaves the server. */
const REFRESH_COOKIE = "eventtz_rt";
/** The current access token, so a reload does not have to spend the refresh. */
const ACCESS_COOKIE = "eventtz_at";
/** When the access token expires, epoch milliseconds. */
const EXPIRES_COOKIE = "eventtz_at_exp";
/**
 * "A session exists" — no secret in it, and deliberately readable by scripts.
 * `SessionProvider` asks synchronously whether to bother trying, which it
 * cannot do against an `httpOnly` cookie.
 */
export const SESSION_MARKER_COOKIE = "eventtz_session";

export const SESSION_COOKIES = {
  refresh: REFRESH_COOKIE,
  access: ACCESS_COOKIE,
  expiresAt: EXPIRES_COOKIE,
  marker: SESSION_MARKER_COOKIE,
} as const;

/**
 * How long the refresh cookie is kept.
 *
 * `api/`'s refresh tokens do not carry their own expiry in the response
 * (`AuthSession` has no refresh TTL field), so this is a client-side ceiling
 * on how long a browser holds an unused cookie; the API's own refresh-token
 * expiry (see `api/app/features/identity/tokens.py`) is what actually revokes it.
 */
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Refresh this long before the access token expires.
 *
 * Refreshing a minute early costs one extra request an hour and avoids the
 * race where a token passes the check here and expires in flight.
 */
export const REFRESH_MARGIN_MS = 60_000;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

function secure(): boolean {
  // Local development is plain http, where a `Secure` cookie is dropped
  // silently and sign-in appears to succeed and then not have.
  return process.env.NODE_ENV === "production";
}

export function readSessionCookies(request: NextRequest): Partial<TokenPair> {
  const expiresAt = Number(request.cookies.get(EXPIRES_COOKIE)?.value);
  return {
    accessToken: request.cookies.get(ACCESS_COOKIE)?.value,
    refreshToken: request.cookies.get(REFRESH_COOKIE)?.value,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
  };
}

export function writeSessionCookies(response: NextResponse, pair: TokenPair): NextResponse {
  const base = {
    httpOnly: true,
    secure: secure(),
    // `Lax` rather than `Strict`: the emailed reset and verification links
    // are top-level navigations from another site, and `Strict` would drop
    // the cookie on exactly those arrivals.
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  } as const;

  response.cookies.set(REFRESH_COOKIE, pair.refreshToken, base);
  response.cookies.set(ACCESS_COOKIE, pair.accessToken, base);
  response.cookies.set(EXPIRES_COOKIE, String(pair.expiresAt), base);
  // The marker is the one a script may read, so it carries no token.
  response.cookies.set(SESSION_MARKER_COOKIE, "1", { ...base, httpOnly: false });
  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  for (const name of Object.values(SESSION_COOKIES)) {
    response.cookies.set(name, "", {
      httpOnly: name !== SESSION_MARKER_COOKIE,
      secure: secure(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
