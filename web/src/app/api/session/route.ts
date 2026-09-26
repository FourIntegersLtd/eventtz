import { NextResponse, type NextRequest } from "next/server";

import { platformApiUrl } from "@/foundation/platform-client/client";
import { clearSessionCookies, readSessionCookies, writeSessionCookies } from "@/foundation/platform-client/sessionCookies";

/**
 * Adopt and forget the platform session.
 *
 * Ported from OSCE `platform-web`. The browser hands a freshly minted pair
 * here once, and from then on the refresh token is this server's business.
 * See `sessionCookies.ts` for why.
 */

/** Never prerendered, never cached: every answer depends on a cookie. */
export const dynamic = "force-dynamic";

interface StoreBody {
  access_token?: unknown;
  refresh_token?: unknown;
  /** Epoch milliseconds, already computed by `foundation/platform-client/auth.ts`. */
  expires_at?: unknown;
}

/** Store a pair the platform API just issued. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: StoreBody;
  try {
    body = (await request.json()) as StoreBody;
  } catch {
    return NextResponse.json({ code: "invalid_request", detail: "Expected JSON" }, { status: 400 });
  }

  const accessToken = typeof body.access_token === "string" ? body.access_token : null;
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : null;
  const expiresAt = typeof body.expires_at === "number" ? body.expires_at : null;
  if (!accessToken || !refreshToken || expiresAt === null) {
    return NextResponse.json({ code: "invalid_request", detail: "Expected a token pair" }, { status: 400 });
  }

  return writeSessionCookies(new NextResponse(null, { status: 204 }), { accessToken, refreshToken, expiresAt });
}

/**
 * Sign out.
 *
 * The refresh token is revoked at `api/` before the cookie goes, because
 * dropping the cookie alone leaves a working thirty-day token in whatever
 * logs or proxies have seen it. A failed revoke still clears the cookies:
 * the person asked to be signed out.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { refreshToken } = readSessionCookies(request);
  if (refreshToken) {
    try {
      await fetch(`${platformApiUrl()}/api/v1/auth/signout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best effort. The local session goes regardless.
    }
  }
  return clearSessionCookies(new NextResponse(null, { status: 204 }));
}
