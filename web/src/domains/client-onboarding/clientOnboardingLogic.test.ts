import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientOnboardingPatch,
  nextStep,
  parsePreferredName,
  previousStep,
  shouldShowOnboarding,
  stepIndex,
} from "@/domains/client-onboarding/clientOnboardingLogic";
import { CLIENT_ONBOARDING_COPY } from "@/domains/client-onboarding/clientOnboardingCopy";

test("stepIndex maps each step to its zero-based tour position", () => {
  assert.equal(stepIndex("welcome"), 0);
  assert.equal(stepIndex("name"), 1);
  assert.equal(stepIndex("finish"), 7);
});

test("nextStep advances through the tour and stops at the last step", () => {
  assert.equal(nextStep("welcome"), "name");
  assert.equal(nextStep("name"), "browse");
  assert.equal(nextStep("disputes"), "finish");
  assert.equal(nextStep("finish"), "finish");
});

test("previousStep moves back and stops at the first step", () => {
  assert.equal(previousStep("name"), "welcome");
  assert.equal(previousStep("finish"), "disputes");
  assert.equal(previousStep("welcome"), "welcome");
});

test("the modal auto-opens only on the first, unfinished, non-dismissed client visit", () => {
  assert.equal(shouldShowOnboarding({ userType: "client", completed: false, dismissed: false, replayOpen: false }), true);
  assert.equal(shouldShowOnboarding({ userType: "client", completed: false, dismissed: true, replayOpen: false }), false);
  assert.equal(shouldShowOnboarding({ userType: "client", completed: true, dismissed: false, replayOpen: false }), false);
  assert.equal(shouldShowOnboarding({ userType: "client", completed: null, dismissed: false, replayOpen: false }), false);
  assert.equal(shouldShowOnboarding({ userType: "vendor", completed: false, dismissed: false, replayOpen: false }), false);
});

test("an explicit replay always reopens the modal", () => {
  assert.equal(shouldShowOnboarding({ userType: "client", completed: true, dismissed: true, replayOpen: true }), true);
});

test("the PATCH body carries only the fields that were provided", () => {
  assert.deepEqual(buildClientOnboardingPatch({ preferredName: "Amina" }), { preferred_name: "Amina" });
  assert.deepEqual(buildClientOnboardingPatch({ markCompleted: true }), { mark_completed: true });
  assert.deepEqual(buildClientOnboardingPatch({}), {});
  assert.deepEqual(buildClientOnboardingPatch({ preferredName: "Amina", markCompleted: true }), {
    preferred_name: "Amina",
    mark_completed: true,
  });
});

test("a blank name is sent as an empty string (clears it), and null is omitted", () => {
  assert.deepEqual(buildClientOnboardingPatch({ preferredName: "" }), { preferred_name: "" });
  assert.deepEqual(buildClientOnboardingPatch({ preferredName: null }), {});
});

test("parsePreferredName trims, rejects blank/over-long names, and returns the trimmed value", () => {
  assert.deepEqual(parsePreferredName("Amina"), { ok: true, value: "Amina" });
  assert.deepEqual(parsePreferredName("  Amina  "), { ok: true, value: "Amina" });
  assert.deepEqual(parsePreferredName("   "), { ok: false, error: "Enter a preferred name." });
  assert.deepEqual(parsePreferredName("a".repeat(81)), { ok: false, error: "Preferred name is too long." });
});

test("the feature-slide copy is intact and every feature slide has headline, body and highlights", () => {
  assert.equal(CLIENT_ONBOARDING_COPY.welcome.headline, "Welcome to Eventtz");
  assert.equal(CLIENT_ONBOARDING_COPY.finish.primaryCta, "Browse vendors");
  assert.equal(CLIENT_ONBOARDING_COPY.name.placeholder, "e.g. Amina");
});
