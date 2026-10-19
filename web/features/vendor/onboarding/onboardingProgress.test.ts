import { describe, expect, it } from "vitest";
import {
  canApplyOnboardingFormUpdate,
  isReturnedForEdits,
  mapLegacyOnboardingStep,
  resolveOnboardingStepFromProfile,
} from "./onboardingProgress";

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
        current_step: 9,
      }),
    ).toBe(false);
  });

  it("is true for a leftover submitted-screen step after unsubmit without the timestamp", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 10,
      }),
    ).toBe(true);
  });

  it("is false after resubmit even if the timestamp is still on the payload", () => {
    expect(
      isReturnedForEdits({
        onboarding_status: "submitted",
        approval_status: "pending",
        current_step: 10,
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
        current_step: 9,
      }),
    ).toBe(false);
  });
});

describe("resolveOnboardingStepFromProfile", () => {
  it("sends submitted pending vendors to step 10", () => {
    expect(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "submitted", approval_status: "pending", current_step: 10 },
        2,
        false,
      ),
    ).toBe(10);
  });

  it("sends draft vendors with saved submitted step to review step 9", () => {
    expect(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "draft", approval_status: "pending", current_step: 10 },
        2,
        false,
      ),
    ).toBe(9);
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

describe("canApplyOnboardingFormUpdate", () => {
  it("allows drafts to update", () => {
    expect(
      canApplyOnboardingFormUpdate({
        lockedPendingReview: false,
        canAddPortfolioWhilePending: false,
      }),
    ).toBe(true);
  });

  it("blocks submitted pending vendors who already have enough photos", () => {
    expect(
      canApplyOnboardingFormUpdate({
        lockedPendingReview: true,
        canAddPortfolioWhilePending: false,
      }),
    ).toBe(false);
  });

  it("allows submitted pending vendors who still need portfolio photos", () => {
    expect(
      canApplyOnboardingFormUpdate({
        lockedPendingReview: true,
        canAddPortfolioWhilePending: true,
      }),
    ).toBe(true);
  });
});

describe("mapLegacyOnboardingStep", () => {
  it("keeps version 3 steps as they are", () => {
    expect(mapLegacyOnboardingStep(5, 3)).toBe(5);
    expect(mapLegacyOnboardingStep(10, 3)).toBe(10);
  });

  it("moves version 2 steps from availability on up by one", () => {
    expect(mapLegacyOnboardingStep(4, 2)).toBe(4);
    expect(mapLegacyOnboardingStep(5, 2)).toBe(6);
    expect(mapLegacyOnboardingStep(8, 2)).toBe(9);
    expect(mapLegacyOnboardingStep(9, 2)).toBe(10);
  });

  it("maps version 1 through version 2 to version 3", () => {
    expect(mapLegacyOnboardingStep(10, 1)).toBe(10);
    expect(mapLegacyOnboardingStep(1, 1)).toBe(1);
  });
});
