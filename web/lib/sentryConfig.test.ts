import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import {
  getSentryDsn,
  getSentryEnvironment,
  getSentrySharedInitOptions,
  getSentryTracesSampleRate,
  sentryBeforeSend,
} from "./sentryConfig";

describe("sentryConfig", () => {
  it("treats missing DSN as empty (no-op)", () => {
    expect(getSentryDsn()).toBe("");
  });

  it("uses NODE_ENV for environment and sample rate when Vercel env is unset", () => {
    expect(getSentryEnvironment()).toMatch(/development|production|test/);
    expect(getSentryTracesSampleRate()).toBeGreaterThan(0);
  });

  it("skips shared init options when DSN is empty", () => {
    expect(getSentrySharedInitOptions()).toBeNull();
  });
});

describe("sentryBeforeSend", () => {
  it("drops events whose exception message contains 'safe to ignore'", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "NEW issue test 1787419764963 - safe to ignore",
          },
        ],
      },
    };

    expect(sentryBeforeSend(event)).toBeNull();
  });

  it("drops events whose top-level message contains 'safe to ignore'", () => {
    const event: ErrorEvent = {
      type: undefined,
      message: "Manual test - SAFE TO IGNORE",
    };

    expect(sentryBeforeSend(event)).toBeNull();
  });

  it("passes through real errors unchanged", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [{ type: "TypeError", value: "Cannot read property 'x' of undefined" }],
      },
    };

    expect(sentryBeforeSend(event)).toBe(event);
  });

  it("drops Instagram in-app browser WKWebView bridge errors", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: "TypeError",
            value: "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
          },
        ],
      },
    };

    expect(sentryBeforeSend(event)).toBeNull();
  });

  it("does not drop unrelated TypeErrors that mention webkit without messageHandlers", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [{ type: "TypeError", value: "webkitRequestAnimationFrame is not a function" }],
      },
    };

    expect(sentryBeforeSend(event)).toBe(event);
  });

  it("drops Instagram Android in-app browser WebView bridge errors", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [
          {
            type: "Error",
            value: "Error invoking postMessage: Java object is gone",
          },
        ],
      },
    };

    expect(sentryBeforeSend(event)).toBeNull();
  });

  it("does not drop unrelated errors that mention postMessage", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: {
        values: [{ type: "Error", value: "Failed to postMessage to conversation" }],
      },
    };

    expect(sentryBeforeSend(event)).toBe(event);
  });
});
