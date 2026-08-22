import { describe, expect, it } from "vitest";
import {
  getSentryDsn,
  getSentryEnvironment,
  getSentryTracesSampleRate,
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
