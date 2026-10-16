import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/v1/[...path]/route";
import { resetRefreshMemoryForTests } from "@/lib/platformSession";

/**
 * The `/api/v1/*` proxy: session cookies in, Bearer token out, token pairs
 * kept server-side. `fetch` stands in for `api/`.
 */

const upstreamCalls: { url: string; init: RequestInit }[] = [];

function answerWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      upstreamCalls.push({ url, init });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
}

function browserRequest(path: string, method: string, cookies = "", body?: string): NextRequest {
  return new NextRequest(`http://localhost:3001/api/v1/${path}`, {
    method,
    headers: { cookie: cookies, "content-type": "application/json" },
    body,
  });
}

function context(path: string) {
  return { params: Promise.resolve({ path: path.split("/") }) };
}

const PAIR = { access_token: "access-1", refresh_token: "refresh-1", expires_at: 1 };
const USER = { id: "user-1", email: "client@example.com" };

beforeEach(() => {
  upstreamCalls.length = 0;
  resetRefreshMemoryForTests();
  process.env.BACKEND_URL = "http://api.test";
});
afterEach(() => vi.unstubAllGlobals());

describe("sign-in", () => {
  it("stores the pair in httpOnly cookies and hides the refresh token from the page", async () => {
    answerWith(200, { success: true, user: USER, session: PAIR });

    const response = await POST(browserRequest("auth/signin", "POST", "", "{}"), context("auth/signin"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      user: USER,
      session: { access_token: "access-1", expires_at: 1 },
    });
    const setCookies = response.headers.getSetCookie().join("\n");
    expect(setCookies).toContain("eventtz_at=access-1");
    expect(setCookies).toContain("eventtz_rt=refresh-1");
    expect(setCookies).toContain("HttpOnly");
  });
});

describe("ordinary calls", () => {
  it("sends the access cookie upstream as a Bearer token and never the cookie header", async () => {
    answerWith(200, { success: true, user: USER });

    await GET(browserRequest("auth/me", "GET", "eventtz_at=access-1; eventtz_rt=refresh-1"), context("auth/me"));

    expect(upstreamCalls[0].url).toBe("http://api.test/api/v1/auth/me");
    const headers = upstreamCalls[0].init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer access-1");
    expect(headers.get("cookie")).toBeNull();
  });

  it("keeps the query string", async () => {
    answerWith(200, []);

    await GET(browserRequest("vendors?page=2&q=dj", "GET"), context("vendors"));

    expect(upstreamCalls[0].url).toBe("http://api.test/api/v1/vendors?page=2&q=dj");
  });
});

describe("refresh", () => {
  it("spends the cookie's refresh token once, even when two tabs ask together", async () => {
    answerWith(200, { success: true, user: USER, session: { ...PAIR, access_token: "access-2", refresh_token: "refresh-2" } });
    const cookies = "eventtz_at=access-1; eventtz_rt=refresh-1";

    const [first, second] = await Promise.all([
      POST(browserRequest("auth/refresh", "POST", cookies, "{}"), context("auth/refresh")),
      POST(browserRequest("auth/refresh", "POST", cookies, "{}"), context("auth/refresh")),
    ]);

    expect(upstreamCalls).toHaveLength(1);
    expect(JSON.parse(upstreamCalls[0].init.body as string)).toEqual({ refresh_token: "refresh-1" });
    expect(first.headers.getSetCookie().join("\n")).toContain("eventtz_rt=refresh-2");
    expect(second.headers.getSetCookie().join("\n")).toContain("eventtz_rt=refresh-2");
  });

  it("clears the cookies when api/ refuses the refresh", async () => {
    answerWith(401, { detail: "Session expired", code: "refresh_token_invalid" });

    const response = await POST(
      browserRequest("auth/refresh", "POST", "eventtz_rt=refresh-1", "{}"),
      context("auth/refresh"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().join("\n")).toContain("eventtz_rt=;");
  });

  it("answers 401 without calling api/ when there is no session", async () => {
    answerWith(200, {});

    const response = await POST(browserRequest("auth/refresh", "POST", "", "{}"), context("auth/refresh"));

    expect(response.status).toBe(401);
    expect(upstreamCalls).toHaveLength(0);
  });
});

describe("sign-out", () => {
  it("revokes the refresh token upstream and clears the cookies", async () => {
    answerWith(200, { success: true });

    const response = await POST(
      browserRequest("auth/signout", "POST", "eventtz_at=access-1; eventtz_rt=refresh-1"),
      context("auth/signout"),
    );

    expect(JSON.parse(upstreamCalls[0].init.body as string)).toEqual({ refresh_token: "refresh-1" });
    expect(response.headers.getSetCookie().join("\n")).toContain("eventtz_at=;");
  });
});
