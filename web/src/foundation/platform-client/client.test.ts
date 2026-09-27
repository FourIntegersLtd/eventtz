import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { platformRequest, platformRequestText, setPlatformTokenSource } from "@/foundation/platform-client/client";
import { PlatformError, PlatformTransportError } from "@/foundation/platform-client/errors";

/** Restores the real `fetch` and drops any token source a test installed. */
function stubFetch(implementation: typeof fetch): void {
  globalThis.fetch = implementation;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setPlatformTokenSource(() => null);
});

describe("platformRequest()", () => {
  it("sends the bearer token, JSON body and query string, and decodes a JSON response", async () => {
    setPlatformTokenSource(() => "test-access-token");
    const captured: { url: string | null; init: RequestInit | null } = { url: null, init: null };
    stubFetch(async (input, init) => {
      captured.url = String(input);
      captured.init = init ?? null;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await platformRequest<{ ok: boolean }>("/api/v1/example", {
      method: "POST",
      body: { name: "Marquee Hire" },
      query: { page: 2, active: true, missing: undefined },
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(captured.url, "http://127.0.0.1:8001/api/v1/example?page=2&active=true");
    assert.equal(captured.init?.method, "POST");
    assert.equal(captured.init?.credentials, "omit");
    const headers = captured.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-access-token");
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(captured.init?.body, JSON.stringify({ name: "Marquee Hire" }));
  });

  it("sends no Authorization header when there is no token", async () => {
    setPlatformTokenSource(() => null);
    const captured: { init: RequestInit | null } = { init: null };
    stubFetch(async (_input, init) => {
      captured.init = init ?? null;
      return new Response(null, { status: 204 });
    });

    const result = await platformRequest<undefined>("/api/v1/example");

    assert.equal(result, undefined);
    const headers = captured.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
  });

  it("throws a PlatformError carrying the code and detail from an ErrorResponse body", async () => {
    stubFetch(async () =>
      new Response(JSON.stringify({ code: "invalid_credentials", detail: "Email or password is wrong." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await assert.rejects(
      () => platformRequest("/api/v1/auth/signin", { method: "POST", body: {} }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformError);
        assert.equal(error.status, 401);
        assert.equal(error.code, "invalid_credentials");
        assert.equal(error.detail, "Email or password is wrong.");
        assert.equal(error.hasCode("invalid_credentials"), true);
        assert.equal(error.hasCode("forbidden"), false);
        return true;
      },
    );
  });

  it("falls back to a generic internal_error body when the response is not shaped like ErrorResponse", async () => {
    stubFetch(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }));

    await assert.rejects(
      () => platformRequest("/api/v1/example"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformError);
        assert.equal(error.status, 502);
        assert.equal(error.code, "internal_error");
        assert.equal(error.detail, "Request failed (502)");
        return true;
      },
    );
  });

  it("returns plain text and headers from platformRequestText()", async () => {
    stubFetch(async () =>
      new Response("<html>receipt</html>", {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": 'attachment; filename="receipt-EVT-ABC.html"',
        },
      }),
    );

    const result = await platformRequestText("/api/v1/client/booking-requests/x/receipt.html");
    assert.equal(result.text, "<html>receipt</html>");
    assert.equal(result.headers.get("Content-Disposition"), 'attachment; filename="receipt-EVT-ABC.html"');
  });

  it("wraps a network failure in a PlatformTransportError", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    await assert.rejects(
      () => platformRequest("/api/v1/example"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformTransportError);
        assert.equal(error.message, "Could not reach the server");
        return true;
      },
    );
  });
});
