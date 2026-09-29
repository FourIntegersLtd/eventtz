/** onboardingProgress.test for the vendor onboarding wizard. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApplyOnboardingFormUpdate,
  isReturnedForEdits,
  resolveOnboardingStepFromProfile,
} from "./onboardingProgress";

describe("isReturnedForEdits", () => {
  it("is true when the server set returnedForEditsAt", () => {
    assert.equal(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 3,
        returnedForEditsAt: "2026-08-15T10:00:00+00:00",
      }),
      true);
  });

  it("is false for first-time review without the timestamp", () => {
    assert.equal(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 8,
      }),
      false);
  });

  it("is true for a leftover submitted-screen step after unsubmit without the timestamp", () => {
    assert.equal(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 9,
      }),
      true);
  });

  it("is false after resubmit even if the timestamp is still on the payload", () => {
    assert.equal(
      isReturnedForEdits({
        onboarding_status: "submitted",
        approval_status: "pending",
        current_step: 9,
        returnedForEditsAt: "2026-08-15T10:00:00+00:00",
      }),
      false);
  });

  it("is false for early draft onboarding", () => {
    assert.equal(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 3,
      }),
      false);
  });

  it("is false when the timestamp is empty", () => {
    assert.equal(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "pending",
        current_step: 3,
        returnedForEditsAt: "",
      }),
      false);
  });

  it("is false for banned profiles at the review step without the timestamp", () => {
    assert.equal(
      isReturnedForEdits({
        onboarding_status: "draft",
        approval_status: "banned",
        current_step: 8,
      }),
      false);
  });
});

describe("resolveOnboardingStepFromProfile", () => {
  it("sends submitted pending vendors to step 9", () => {
    assert.equal(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "submitted", approval_status: "pending", current_step: 9 },
        2,
        false,
      ),
      9);
  });

  it("sends draft vendors with saved submitted step to review step 8", () => {
    assert.equal(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "draft", approval_status: "pending", current_step: 9 },
        2,
        false,
      ),
      8);
  });

  it("keeps early draft vendors on their saved step", () => {
    assert.equal(
      resolveOnboardingStepFromProfile(
        { onboarding_status: "draft", approval_status: "pending", current_step: 3 },
        2,
        false,
      ),
      3);
  });
});

describe("canApplyOnboardingFormUpdate", () => {
  it("allows drafts to update", () => {
    assert.equal(
      canApplyOnboardingFormUpdate({
        lockedPendingReview: false,
        canAddPortfolioWhilePending: false,
      }),
      true);
  });

  it("blocks submitted pending vendors who already have enough photos", () => {
    assert.equal(
      canApplyOnboardingFormUpdate({
        lockedPendingReview: true,
        canAddPortfolioWhilePending: false,
      }),
      false);
  });

  it("allows submitted pending vendors who still need portfolio photos", () => {
    assert.equal(
      canApplyOnboardingFormUpdate({
        lockedPendingReview: true,
        canAddPortfolioWhilePending: true,
      }),
      true);
  });
});
