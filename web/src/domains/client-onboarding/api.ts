/**
 * Requests for the client's first-visit onboarding against
 * `PATCH /api/v1/client/onboarding` (the baseline's `clientOnboardingApi.ts`
 * also has a `GET`, but that only backs the settings account name-editor, a
 * different slice with no caller here).
 */
import { platformRequest, type components } from "@/foundation/platform-client";
import { buildClientOnboardingPatch, type ClientOnboardingPatchInput } from "@/domains/client-onboarding/clientOnboardingLogic";

/** Whether a client finished first-visit setup, and what they like to be called. */
export type ClientOnboardingState = components["schemas"]["ClientOnboardingState"];

/** Save the preferred name and/or mark onboarding complete. */
export async function updateClientOnboarding(input: ClientOnboardingPatchInput): Promise<ClientOnboardingState> {
  const response = await platformRequest<components["schemas"]["ClientOnboardingResponse"]>("/api/v1/client/onboarding", {
    method: "PATCH",
    body: buildClientOnboardingPatch(input),
  });
  return response.onboarding;
}
