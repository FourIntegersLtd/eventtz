import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clearPlatformSession,
  hasStoredSession,
  platformAccessToken,
  rememberPlatformSession,
} from "@/foundation/platform-client/auth";
import { SESSION_MARKER_COOKIE } from "@/foundation/platform-client/sessionCookies";

/**
 * Session-refresh behaviour of `foundation/platform-client/auth.ts`.
 *
 * `document.cookie` and `navigator.locks` do not exist under `node --test`,
 * so each test fakes the minimum of both: a `document` with a settable
 * `cookie` string (mirroring how the marker cookie is read and cleared), and
 * no `navigator.locks`, which exercises the documented fallback in
 * `withSessionLock` — running the refresh directly rather than serialising
 * it through a named lock.
 */

const originalFetch = globalThis.fetch;
const originalDocument = (globalThis as { document?: unknown }).document;

/**
 * A minimal stand-in for `document.cookie`: a real browser's cookie jar
 * coalesces every `name=value; ...` assignment into one string and drops an
 * entry once its `max-age` reaches zero. `auth.ts`'s `hasMarker()` reads that
 * coalesced string and `dropMarker()` relies on the zero-max-age deletion, so
 * a fake that just stored the last-assigned string verbatim would keep
 * seeing a "deleted" cookie via `startsWith`. This jar parses each
 * assignment and removes the entry instead.
 */
function fakeDocumentWithCookie(initialCookie: string): { cookie: string } {
  const jar = new Map<string, string>();
  for (const entry of initialCookie.split(";")) {
    const [name, value] = entry.split("=").map((part) => part.trim());
    if (name) jar.set(name, value ?? "");
  }
  const store = {
    get cookie(): string {
      return Array.from(jar.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    },
    set cookie(assignment: string) {
      const [pair = "", ...attributes] = assignment.split(";").map((part) => part.trim());
      const [name = "", value = ""] = pair.split("=").map((part) => part.trim());
      if (!name) return;
      const expired = attributes.some((attribute) => attribute.toLowerCase() === "max-age=0");
      if (expired) jar.delete(name);
      else jar.set(name, value);
    },
  };
  (globalThis as { document?: unknown }).document = store;
  return store;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDocument === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document?: unknown }).document = originalDocument;
  }
  clearPlatformSession();
});

describe("rememberPlatformSession()", () => {
  it("POSTs the pair to /api/session and caches the access token in memory", async () => {
    fakeDocumentWithCookie("");
    let capturedBody: unknown = null;
    globalThis.fetch = (async (input, init) => {
      assert.equal(String(input), "/api/session");
      capturedBody = JSON.parse(String(init?.body));
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await rememberPlatformSession({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_at: Math.floor(Date.now() / 1000) + 900,
    });

    assert.equal((capturedBody as { access_token: string }).access_token, "access-1");
    assert.equal((capturedBody as { refresh_token: string }).refresh_token, "refresh-1");

    // The token is now cached: reading it makes no request at all.
    globalThis.fetch = (async () => {
      throw new Error("platformAccessToken should not have called fetch");
    }) as typeof fetch;
    const token = await platformAccessToken();
    assert.equal(token, "access-1");
  });
});

describe("platformAccessToken()", () => {
  it("returns null with no cached token and no session marker cookie, making no request", async () => {
    fakeDocumentWithCookie("");
    globalThis.fetch = (async () => {
      throw new Error("platformAccessToken should not have called fetch");
    }) as typeof fetch;

    const token = await platformAccessToken();
    assert.equal(token, null);
  });

  it("refreshes via /api/session/token when a marker cookie exists but no token is cached", async () => {
    fakeDocumentWithCookie(`${SESSION_MARKER_COOKIE}=1`);
    let requestCount = 0;
    globalThis.fetch = (async (input, init) => {
      requestCount += 1;
      assert.equal(String(input), "/api/session/token");
      assert.equal(init?.method, "POST");
      return new Response(
        JSON.stringify({ access_token: "refreshed-access", expires_at: Date.now() + 900_000 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const token = await platformAccessToken();
    assert.equal(token, "refreshed-access");
    assert.equal(requestCount, 1);
  });

  it("forgets the local session when the refresh endpoint reports no access token", async () => {
    fakeDocumentWithCookie(`${SESSION_MARKER_COOKIE}=1`);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ access_token: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    const token = await platformAccessToken();
    assert.equal(token, null);
    assert.equal(hasStoredSession(), false);
  });

  it("does not refresh again while the cached token is still well within its lifetime", async () => {
    fakeDocumentWithCookie("");
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await rememberPlatformSession({
      access_token: "still-fresh",
      refresh_token: "refresh-1",
      expires_at: Math.floor(Date.now() / 1000) + 900,
    });
    assert.equal(requestCount, 1);

    const token = await platformAccessToken();
    assert.equal(token, "still-fresh");
    assert.equal(requestCount, 1);
  });
});

describe("clearPlatformSession()", () => {
  it("drops the cached token and the marker cookie", async () => {
    const store = fakeDocumentWithCookie(`${SESSION_MARKER_COOKIE}=1`);
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    await rememberPlatformSession({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_at: Math.floor(Date.now() / 1000) + 900,
    });

    clearPlatformSession();

    assert.equal(hasStoredSession(), false);
    assert.equal(store.cookie.includes(`${SESSION_MARKER_COOKIE}=`), false);
  });
});
