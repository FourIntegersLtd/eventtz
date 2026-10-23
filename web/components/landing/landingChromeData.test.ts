import { describe, expect, it } from "vitest";
import { resolveLandingSectionPrefix } from "@/components/landing/landingChromeData";

describe("resolveLandingSectionPrefix", () => {
  it("uses empty prefix on the home page", () => {
    expect(resolveLandingSectionPrefix("/", "")).toBe("");
  });

  it("uses slash prefix off the home page", () => {
    expect(resolveLandingSectionPrefix("/client/browse", "")).toBe("/");
    expect(resolveLandingSectionPrefix("/blog", "")).toBe("/");
  });

  it("keeps an explicit home prefix when provided", () => {
    expect(resolveLandingSectionPrefix("/", "/")).toBe("/");
  });
});
