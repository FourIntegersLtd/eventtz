import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirects and CSP only (`docs/rebuild-workstreams.md` §10). No session
 * check happens here: `httpOnly` cookies cannot be read by client code, and
 * a wrong guess in middleware would just duplicate `RequireSession`
 * (`foundation/session/guards.tsx`), which is the one place that owns it.
 *
 * There are no retired baseline paths to redirect yet — every URL under
 * `(auth)` and `(marketing)` matches `frontend/app` exactly — so the redirect
 * table starts empty and is the place to add one when a route moves.
 */

const RETIRED_REDIRECTS: Record<string, string> = {};

function contentSecurityPolicy(): string {
  // `next dev` evaluates its bundles with eval(); without this no client code
  // runs locally and every page stays on its first server-rendered frame.
  // Production builds do not eval, so they keep the stricter policy.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest): NextResponse {
  const retired = RETIRED_REDIRECTS[request.nextUrl.pathname];
  if (retired) {
    return NextResponse.redirect(new URL(retired, request.url), 308);
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", contentSecurityPolicy());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
