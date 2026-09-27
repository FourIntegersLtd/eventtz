/**
 * Pure logic for the client welcome onboarding: which step shows, whether the
 * modal should open, the preferred-name validation, and the PATCH request body.
 * Kept free of React and `fetch` so it is testable with `node --test`.
 */
import { CLIENT_ONBOARDING_STEPS, type ClientOnboardingStep } from "@/domains/client-onboarding/clientOnboardingCopy";
import type { components } from "@/foundation/platform-client";

/** Zero-based position of a step in the tour, for the progress bar and Back/Continue buttons. */
export function stepIndex(step: ClientOnboardingStep): number {
  return CLIENT_ONBOARDING_STEPS.indexOf(step);
}

/** The step after `step`, or `step` itself when it is already last (used only where a next step exists). */
export function nextStep(step: ClientOnboardingStep): ClientOnboardingStep {
  const index = stepIndex(step);
  return index < CLIENT_ONBOARDING_STEPS.length - 1 ? CLIENT_ONBOARDING_STEPS[index + 1]! : step;
}

/** The step before `step`, or `step` itself when it is already first. */
export function previousStep(step: ClientOnboardingStep): ClientOnboardingStep {
  const index = stepIndex(step);
  return index > 0 ? CLIENT_ONBOARDING_STEPS[index - 1]! : step;
}

export type OnboardingOpenDecision = {
  /** The `/auth/me` account kind; the tour only auto-shows for clients. */
  userType: string | undefined;
  /** The raw `/auth/me` flag — a first visit is explicitly `false`, not `null`/unset. */
  completed: boolean | null | undefined;
  /** The visitor closed the tour this session without finishing, so it stays shut. */
  dismissed: boolean;
  /** The "Show tour again" control explicitly asked for it. */
  replayOpen: boolean;
};

/**
 * Whether the tour should be visible right now. It auto-shows only once: a
 * client whose onboarding is not yet completed (`=== false`) and who has not
 * dismissed it. Replaying always wins.
 */
export function shouldShowOnboarding(decision: OnboardingOpenDecision): boolean {
  const autoShow = !decision.dismissed && decision.userType === "client" && decision.completed === false;
  return decision.replayOpen || autoShow;
}

export type ClientOnboardingPatchInput = {
  preferredName?: string | null;
  markCompleted?: boolean;
};

/**
 * The body for `PATCH /api/v1/client/onboarding`. `null`/`undefined` fields are
 * omitted so a blank name clears it and an absent flag leaves it untouched —
 * matching the baseline's `input.x ?? undefined` shape.
 */
export function buildClientOnboardingPatch(input: ClientOnboardingPatchInput): components["schemas"]["ClientOnboardingPatchBody"] {
  const body: components["schemas"]["ClientOnboardingPatchBody"] = {};
  if (input.preferredName !== undefined && input.preferredName !== null) {
    body.preferred_name = input.preferredName;
  }
  if (input.markCompleted !== undefined) {
    body.mark_completed = input.markCompleted;
  }
  return body;
}

/** A successful parse carries the trimmed value to send; a failure carries the message to show. */
export type PreferredNameParse = { ok: true; value: string } | { ok: false; error: string };

const PREFERRED_NAME_MAX_LENGTH = 80;

/** Trim then require a non-blank name of at most 80 characters (baseline `preferredNameSchema`). */
export function parsePreferredName(raw: string): PreferredNameParse {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "Enter a preferred name." };
  if (trimmed.length > PREFERRED_NAME_MAX_LENGTH) return { ok: false, error: "Preferred name is too long." };
  return { ok: true, value: trimmed };
}
