import { NextResponse, type NextRequest } from "next/server";

import { platformApiUrl } from "@/foundation/platform-client/client";
import { REFRESH_MARGIN_MS, clearSessionCookies, readSessionCookies, writeSessionCookies } from "@/foundation/platform-client/sessionCookies";

/**
 * The current access token, refreshed here if it is due.
 *
 * Ported from OSCE `platform-web`. Answering from the stored access token
 * whenever it is still good is what keeps the refresh token from being spent
 * on every reload and every new tab — `api/`'s refresh tokens are single-use
 * with reuse detection (`api/app/features/identity/tokens.py`), so two
 * spends of the same token reads as theft.
 *
 * `POST` rather than `GET` so nothing caches it and `SameSite=Lax` never
 * sends the cookie on a cross-site subrequest to it.
 */

export const dynamic = "force-dynamic";

function noSession(): NextResponse {
  return NextResponse.json({ access_token: null }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { accessToken, refreshToken, expiresAt } = readSessionCookies(request);

  if (accessToken && expiresAt && Date.now() < expiresAt - REFRESH_MARGIN_MS) {
    return NextResponse.json({ access_token: accessToken, expires_at: expiresAt });
  }
  if (!refreshToken) return noSession();

  let response: Response;
  try {
    response = await fetch(`${platformApiUrl()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // api/ unreachable. The chain is probably fine, so the cookies stay and
    // the caller can try again rather than being signed out by a blip.
    return NextResponse.json({ code: "transport_error", detail: "Could not reach the server" }, { status: 503 });
  }

  if (!response.ok) {
    // A refused refresh means the chain is spent or revoked. Dropping it
    // sends the next call back through sign-in rather than retrying a token
    // that will never work again.
    return clearSessionCookies(noSession());
  }

  const payload = (await response.json()) as {
    session: { access_token: string; refresh_token: string; expires_at?: number | null };
  };
  const pair = payload.session;
  const expiresAtMs = typeof pair.expires_at === "number" ? pair.expires_at * 1000 : Date.now() + 15 * 60 * 1000;

  return writeSessionCookies(
    NextResponse.json({ access_token: pair.access_token, expires_at: expiresAtMs }),
    { accessToken: pair.access_token, refreshToken: pair.refresh_token, expiresAt: expiresAtMs },
  );
}
