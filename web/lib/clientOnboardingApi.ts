import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type ClientOnboardingState = components["schemas"]["ClientOnboardingState"];

type ClientOnboardingResponse = components["schemas"]["ClientOnboardingResponse"];
type ClientOnboardingPatchBody = components["schemas"]["ClientOnboardingPatchBody"];

export async function getClientOnboarding(): Promise<ClientOnboardingState> {
  const { data } = await api.get<ClientOnboardingResponse>("/api/v1/client/onboarding");
  return data.onboarding;
}

export async function updateClientOnboarding(input: {
  preferredName?: string | null;
  markCompleted?: boolean;
}): Promise<ClientOnboardingState> {
  const body: ClientOnboardingPatchBody = {
    preferred_name: input.preferredName ?? undefined,
    mark_completed: input.markCompleted ?? undefined,
  };
  const { data } = await api.patch<ClientOnboardingResponse>("/api/v1/client/onboarding", body);
  return data.onboarding;
}
