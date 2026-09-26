import { platformRequest, setPlatformTokenSource } from "@/foundation/platform-client/client";
import { REFRESH_MARGIN_MS, SESSION_MARKER_COOKIE } from "@/foundation/platform-client/sessionCookies";
import type { components } from "@/foundation/platform-client/schema";

/**
 * The platform session: tokens in, tokens refreshed, tokens forgotten.
 *
 * Ported from OSCE `platform-web`'s `auth.ts`. `api/`'s identity slice issues
 * bare token pairs (`AuthSession`) and sets no cookies of its own — this
 * module holds the access token in memory, and the refresh token goes
 * straight into an `httpOnly` cookie owned by `web`'s own `/api/session`
 * route handlers. See `sessionCookies.ts` for why.
 */

type AuthSession = components["schemas"]["AuthSession"];
type AuthUser = components["schemas"]["AuthUser"];

/** This app's own session endpoints, not the platform API's. */
const SESSION_ENDPOINT = "/api/session";
const TOKEN_ENDPOINT = "/api/session/token";

/** Default access-token lifetime, matching `api/app/core/settings.py`'s `jwt_access_ttl_seconds`. */
const DEFAULT_ACCESS_TTL_MS = 15 * 60 * 1000;

interface CachedToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

let session: CachedToken | null = null;
let inFlight: Promise<string | null> | null = null;

/* ---------- the session marker ---------- */

function hasMarker(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((entry) => entry.trim().startsWith(`${SESSION_MARKER_COOKIE}=`));
}

function dropMarker(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_MARKER_COOKIE}=; path=/; max-age=0`;
}

/* ---------- storing and forgetting ---------- */

/** Drop what this tab holds. The server's cookies are cleared separately. */
function forgetLocally(): void {
  session = null;
  inFlight = null;
  dropMarker();
}

function expiresAtMs(session_: Pick<AuthSession, "expires_at">): number {
  // `expires_at` is seconds since the epoch (see `AuthSession` in
  // `api/app/features/identity/schemas.py`); it can be absent, in which case
  // the access token's known default TTL is assumed.
  if (typeof session_.expires_at === "number") return session_.expires_at * 1000;
  return Date.now() + DEFAULT_ACCESS_TTL_MS;
}

async function remember(pair: AuthSession): Promise<void> {
  const expiresAt = expiresAtMs(pair);
  const response = await fetch(SESSION_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_token: pair.access_token,
      refresh_token: pair.refresh_token,
      expires_at: expiresAt,
    }),
  });
  if (!response.ok) {
    // Without the cookie there is no session to come back to on the next
    // page load, so failing loudly beats appearing to sign in and not having.
    throw new Error("Could not store the session");
  }
  session = { accessToken: pair.access_token, expiresAt };
}

/**
 * Adopt a pair the platform just issued.
 *
 * Awaitable, so a caller that navigates immediately after does not race the
 * cookie being set.
 */
export async function rememberPlatformSession(pair: AuthSession): Promise<void> {
  await remember(pair);
}

/** Forget the platform session locally. `logout()` also revokes it server side. */
export function clearPlatformSession(): void {
  forgetLocally();
}

/* ---------- reading the token ---------- */

/**
 * Hold a named lock across every tab on this origin, if the browser has them.
 *
 * Refresh tokens are single-use with reuse detection and every tab shares one
 * cookie, so two tabs refreshing at the same moment would spend the same
 * token twice. Serialising them here means the second tab arrives after the
 * first already stored a new pair, and the server answers it from the cookie
 * without refreshing again.
 */
async function withSessionLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return run();
  return locks.request("eventtz-platform-session", run);
}

async function fetchToken(): Promise<string | null> {
  return withSessionLock(async () => {
    let response: Response;
    try {
      response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
    } catch {
      // Offline, or web's own server is down. Not a reason to sign anybody
      // out; the caller can try again.
      return null;
    }
    if (!response.ok) return null;

    const body = (await response.json()) as { access_token: string | null; expires_at?: number };
    if (!body.access_token) {
      // The server already cleared the cookies: the chain was spent or
      // revoked, or there was never a session here.
      forgetLocally();
      return null;
    }
    session = {
      accessToken: body.access_token,
      expiresAt: body.expires_at ?? Date.now() + REFRESH_MARGIN_MS,
    };
    return session.accessToken;
  });
}

/**
 * The access token, refreshed if it is about to expire.
 *
 * Concurrent callers in this tab share one request, and `withSessionLock`
 * covers the other tabs.
 */
export async function platformAccessToken(): Promise<string | null> {
  if (session && Date.now() < session.expiresAt - REFRESH_MARGIN_MS) return session.accessToken;
  // No marker means no session at all, and asking would be a pointless round
  // trip on every anonymous page.
  if (!session && !hasMarker()) return null;
  inFlight ??= fetchToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Install the token source. Call once, where the app starts (`SessionProvider`). */
export function installPlatformAuth(): void {
  setPlatformTokenSource(platformAccessToken);
}

export function hasStoredSession(): boolean {
  return Boolean(session?.accessToken) || hasMarker();
}

/* ---------- signing in and out ---------- */

type SignInResponse = components["schemas"]["SignInResponse"];
type SignupResponse = components["schemas"]["SignupResponse"];
type ResetPasswordResponse = components["schemas"]["ResetPasswordResponse"];
type VerifyEmailResponse = components["schemas"]["VerifyEmailResponse"];

/** Sign in with email and password. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const result = await platformRequest<SignInResponse>("/api/v1/auth/signin", {
    method: "POST",
    body: { email, password },
  });
  await remember(result.session);
  return result.user;
}

/**
 * Create a client or vendor account.
 *
 * `session` is always empty on the baseline contract
 * (`SignupResponse.session`): the account must verify its email, then sign
 * in. `message` carries the "check your email" copy.
 */
export async function register(input: {
  email: string;
  password: string;
  userType: "client" | "vendor";
  referralCode?: string | null;
}): Promise<{ user: AuthUser; message: string | null }> {
  const result = await platformRequest<SignupResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
      user_type: input.userType,
      referral_code: input.referralCode ?? null,
    },
  });
  if (result.session) await remember(result.session);
  return { user: result.user, message: result.message ?? null };
}

/**
 * Sign out. Revokes the refresh token server side (`web`'s own `/api/session`
 * route, which is the only side that still holds it), then forgets locally.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(SESSION_ENDPOINT, { method: "DELETE", credentials: "same-origin" });
  } catch {
    // Revoking is best effort; the local session goes regardless.
  } finally {
    forgetLocally();
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await platformRequest<void>("/api/v1/auth/forgot-password", { method: "POST", body: { email } });
}

/**
 * Finish a password reset. The token comes from the emailed link; a refused
 * one is expired or already spent.
 */
export async function confirmPasswordReset(token: string, password: string): Promise<AuthUser> {
  const result = await platformRequest<ResetPasswordResponse>("/api/v1/auth/reset-password", {
    method: "POST",
    body: { token, password },
  });
  await remember(result.session);
  return result.user;
}

export async function resendVerification(email: string): Promise<string> {
  const result = await platformRequest<{ success: boolean; message: string }>(
    "/api/v1/auth/resend-verification",
    { method: "POST", body: { email } },
  );
  return result.message;
}

/** Confirm the token from a verification email. `session` is always empty; the user signs in next. */
export async function verifyEmail(token: string): Promise<string> {
  const result = await platformRequest<VerifyEmailResponse>("/api/v1/auth/verify-email", {
    method: "POST",
    body: { token },
  });
  return result.message;
}
