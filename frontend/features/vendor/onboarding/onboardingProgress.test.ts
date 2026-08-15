import { describe, expect, it } from "vitest";
import {
  isProfileReturnedForEdits,
  resolveOnboardingStepFromProfile,
  vendorHasReturnedForEditsFlag,
} from "./onboardingProgress";

describe("isProfileReturnedForEdits", () => {
  it("detects draft profiles saved at review after admin return", () => {
    expect(
      isProfileReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 8,
      }),
    ).toBe(true);
  });

  it("ignores early draft onboarding", () => {
    expect(
      isProfileReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 3,
      }),
    ).toBe(false);
  });
});

describe("vendorHasReturnedForEditsFlag", () => {
  it("is true when server set returnedForEditsAt", () => {
    expect(vendorHasReturnedForEditsFlag("2026-08-15T10:00:00+00:00")).toBe(true);
  });

  it("is false when flag is absent", () => {
    expect(vendorHasReturnedForEditsFlag("")).toBe(false);
  });
});

describe("resolveOnboardingStepFromProfile", () => {
  it("sends submitted pending vendors to step 9", () => {
    expect(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "submitted", approval_status: "pending", current_step: 9 },
        2,
        false,
      ),
    ).toBe(9);
  });

  it("sends draft vendors with saved submitted step to review step 8", () => {
    expect(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "draft", approval_status: "pending", current_step: 9 },
        2,
        false,
      ),
    ).toBe(8);
  });

  it("keeps early draft vendors on their saved step", () => {
    expect(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "draft", approval_status: "pending", current_step: 3 },
        2,
        false,
      ),
    ).toBe(3);
  });
});
