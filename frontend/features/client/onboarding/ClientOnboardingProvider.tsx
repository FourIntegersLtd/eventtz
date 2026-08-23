"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { updateClientOnboarding } from "@/lib/clientOnboardingApi";
import { withMutationFeedback } from "@/lib/mutationFeedback";

type ClientOnboardingContextValue = {
  shouldShow: boolean;
  saving: boolean;
  openReplay: () => void;
  savePreferredName: (preferredName: string) => Promise<void>;
  complete: () => Promise<void>;
  dismiss: () => void;
};

const ClientOnboardingContext = createContext<ClientOnboardingContextValue | null>(null);

export function ClientOnboardingProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [dismissedAuto, setDismissedAuto] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const shouldShowAuto =
    !dismissedAuto &&
    user?.user_type === "client" &&
    user.client_onboarding_completed === false;

  const shouldShow = shouldShowAuto || replayOpen;

  const dismiss = useCallback(() => {
    setDismissedAuto(true);
    setReplayOpen(false);
  }, []);

  const openReplay = useCallback(() => {
    setReplayOpen(true);
  }, []);

  const savePreferredName = useCallback(
    async (preferredName: string) => {
      setSaving(true);
      try {
        await updateClientOnboarding({ preferredName });
        await refreshUser();
      } finally {
        setSaving(false);
      }
    },
    [refreshUser],
  );

  const complete = useCallback(async () => {
    const ok = await withMutationFeedback(showToast, {
      successTitle: "Onboarding complete",
      showSuccessToast: false,
      errorTitle: "Could not finish onboarding",
      errorDescription: "Please try again.",
      run: async () => {
        if (!user?.client_onboarding_completed) {
          await updateClientOnboarding({ markCompleted: true });
        }
        await refreshUser();
      },
    });
    if (ok !== null) dismiss();
  }, [dismiss, refreshUser, showToast, user?.client_onboarding_completed]);

  const value = useMemo<ClientOnboardingContextValue>(
    () => ({
      shouldShow,
      saving,
      openReplay,
      savePreferredName,
      complete,
      dismiss,
    }),
    [shouldShow, saving, openReplay, savePreferredName, complete, dismiss],
  );

  return (
    <ClientOnboardingContext.Provider value={value}>{children}</ClientOnboardingContext.Provider>
  );
}

export function useClientOnboarding(): ClientOnboardingContextValue {
  const ctx = useContext(ClientOnboardingContext);
  if (!ctx) {
    throw new Error("useClientOnboarding must be used inside ClientOnboardingProvider");
  }
  return ctx;
}
