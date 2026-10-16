import { NextResponse, type NextRequest } from "next/server";
import { getBackendBaseUrl } from "@/lib/backend-url";
import {
  clearSession,
  isPlatformSession,
  type PlatformSession,
  readSession,
  refreshOnce,
  writeSession,
} from "@/lib/platformSession";

/**
 * Same-origin `/api/v1/*` → `api/`, adding the signed-in user's Bearer token.
 *
 * Replaces the baseline's plain rewrite to FastAPI. The browser code still
 * calls `/api/v1/...` with cookies exactly as it did against `backend/`; this
 * handler turns the session cookies into the `Authorization` header `api/`
 * expects, and keeps the token pairs `api/` returns out of the browser
 * (see `lib/platformSession.ts`).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Request headers worth passing upstream. Cookies stay here; the session goes as Bearer. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "stripe-signature",
];

/** Response headers that describe the upstream connection, not the body we send on. */
const DROPPED_RESPONSE_HEADERS = ["set-cookie", "content-encoding", "content-length", "transfer-encoding", "connection"];

type RouteContext = { params: Promise<{ path: string[] }> };

function forwardedHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) headers.delete(name);
  return headers;
}

/**
 * A JSON answer to an auth call with any refresh token taken out.
 *
 * The browser code never reads the tokens (the baseline kept them in cookies
 * too), so the refresh token, which outlives the access token by weeks, never
 * reaches client-side JavaScript.
 */
function withoutRefreshToken(body: Record<string, unknown>): Record<string, unknown> {
  if (!isPlatformSession(body.session)) return body;
  const publicSession: Partial<PlatformSession> = { ...body.session };
  delete publicSession.refresh_token;
  return { ...body, session: publicSession };
}

/** `POST /auth/refresh`: spend the cookie's refresh token, not one from the body. */
async function refresh(request: NextRequest): Promise<NextResponse> {
  const { refreshToken } = readSession(request);
  if (!refreshToken) {
    return NextResponse.json({ detail: "Not signed in", code: "not_authenticated" }, { status: 401 });
  }
  let outcome;
  try {
    outcome = await refreshOnce(refreshToken, forwardedHeaders(request));
  } catch {
    // api/ unreachable: keep the cookies so a blip does not sign anyone out.
    return NextResponse.json({ detail: "Could not reach the server", code: "transport_error" }, { status: 503 });
  }
  const body = outcome.body ?? {};
  const response = NextResponse.json(withoutRefreshToken(body), { status: outcome.status });
  if (outcome.status < 300 && isPlatformSession(body.session)) {
    writeSession(response, body.session);
  } else if (outcome.status === 401 || outcome.status === 403) {
    // A refused refresh means the sign-in is spent or revoked.
    clearSession(response);
  }
  return response;
}

/** `POST /auth/signout`: revoke this browser's refresh token upstream, then drop the cookies. */
async function signOut(request: NextRequest): Promise<NextResponse> {
  const { accessToken, refreshToken } = readSession(request);
  const headers = forwardedHeaders(request);
  headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  try {
    await fetch(`${getBackendBaseUrl()}/api/v1/auth/signout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: refreshToken ?? null }),
      cache: "no-store",
    });
  } catch {
    // Best effort: the person asked to be signed out, so the cookies go regardless.
  }
  const response = NextResponse.json({ success: true });
  clearSession(response);
  return response;
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const joinedPath = path.map(encodeURIComponent).join("/");

  if (request.method === "POST" && joinedPath === "auth/refresh") return refresh(request);
  if (request.method === "POST" && joinedPath === "auth/signout") return signOut(request);

  const headers = forwardedHeaders(request);
  const { accessToken } = readSession(request);
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(`${getBackendBaseUrl()}/api/v1/${joinedPath}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  // Sign-in, email verification and password reset answer with a fresh pair.
  const isAuthCall = joinedPath.startsWith("auth/");
  const isJson = upstream.headers.get("content-type")?.includes("application/json");
  if (isAuthCall && isJson) {
    const body = (await upstream.json()) as Record<string, unknown>;
    const response = NextResponse.json(withoutRefreshToken(body), {
      status: upstream.status,
      headers: responseHeaders(upstream),
    });
    if (upstream.ok && isPlatformSession(body.session)) writeSession(response, body.session);
    return response;
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders(upstream) });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
