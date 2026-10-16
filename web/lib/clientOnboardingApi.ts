import api from "@/lib/axios";

export type ClientOnboardingState = {
  completed: boolean;
  preferred_name: string | null;
};

type ClientOnboardingResponse = {
  success: boolean;
  onboarding: ClientOnboardingState;
};

export async function getClientOnboarding(): Promise<ClientOnboardingState> {
  const { data } = await api.get<ClientOnboardingResponse>("/api/v1/client/onboarding");
  return data.onboarding;
}

export async function updateClientOnboarding(input: {
  preferredName?: string | null;
  markCompleted?: boolean;
}): Promise<ClientOnboardingState> {
  const { data } = await api.patch<ClientOnboardingResponse>("/api/v1/client/onboarding", {
    preferred_name: input.preferredName ?? undefined,
    mark_completed: input.markCompleted ?? undefined,
  });
  return data.onboarding;
}
