import { describe, expect, it } from "vitest";
import { isReturnedForEdits, resolveOnboardingStepFromProfile } from "./onboardingProgress";

describe("isReturnedForEdits", () => {
  it("is true when the server set returnedForEditsAt", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 3,
        returnedForEditsAt: "2026-08-15T10:00:00+00:00",
      }),
    ).toBe(true);
  });

  it("is false for first-time review without the timestamp", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 8,
      }),
    ).toBe(false);
  });

  it("is true for a leftover submitted-screen step after unsubmit without the timestamp", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 9,
      }),
    ).toBe(true);
  });

  it("is false after resubmit even if the timestamp is still on the payload", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "submitted",
        approval_status: "pending",
        current_step: 9,
        returnedForEditsAt: "2026-08-15T10:00:00+00:00",
      }),
    ).toBe(false);
  });

  it("is false for early draft onboarding", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 3,
      }),
    ).toBe(false);
  });

  it("is false when the timestamp is empty", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 3,
        returnedForEditsAt: "",
      }),
    ).toBe(false);
  });

  it("is false for banned profiles at the review step without the timestamp", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "banned",
        current_step: 8,
      }),
    ).toBe(false);
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
