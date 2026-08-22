import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import {
  getSentryDsn,
  getSentryEnvironment,
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
});
