"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/foundation/session";
import { updateClientOnboarding } from "@/domains/client-onboarding/api";
import { shouldShowOnboarding } from "@/domains/client-onboarding/clientOnboardingLogic";

type ClientOnboardingContextValue = {
  shouldShow: boolean;
  saving: boolean;
  openReplay: () => void;
  savePreferredName: (preferredName: string) => Promise<void>;
  complete: () => Promise<void>;
  dismiss: () => void;
};

const ClientOnboardingContext = createContext<ClientOnboardingContextValue | null>(null);

/**
 * Holds the welcome tour's visibility and the two saves (name, completed).
 *
 * The baseline's `ClientOnboardingProvider` reads the same `/auth/me` fields
 * and calls the same `PATCH /api/v1/client/onboarding`; here the session user
 * and its re-fetch come from `useSession`, and `markCompleted` is not sent
 * again once the tour is already finished.
 */
export function ClientOnboardingProvider({ children }: { children: ReactNode }) {
  const { session, refresh } = useSession();
  const user = session?.user;
  const [dismissedAuto, setDismissedAuto] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const shouldShow = shouldShowOnboarding({
    userType: user?.user_type,
    completed: user?.client_onboarding_completed,
    dismissed: dismissedAuto,
    replayOpen,
  });

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
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const complete = useCallback(async () => {
    setSaving(true);
    try {
      if (!user?.client_onboarding_completed) {
        await updateClientOnboarding({ markCompleted: true });
      }
      await refresh();
      dismiss();
    } catch (cause: unknown) {
      // No toast in `web/`; on failure the tour simply re-shows next visit
      // (completed stays false), the same end state the baseline's error toast leaves.
      void cause;
    } finally {
      setSaving(false);
    }
  }, [dismiss, refresh, user]);

  const value = useMemo<ClientOnboardingContextValue>(
    () => ({ shouldShow, saving, openReplay, savePreferredName, complete, dismiss }),
    [shouldShow, saving, openReplay, savePreferredName, complete, dismiss],
  );

  return <ClientOnboardingContext.Provider value={value}>{children}</ClientOnboardingContext.Provider>;
}

export function useClientOnboarding(): ClientOnboardingContextValue {
  const context = useContext(ClientOnboardingContext);
  if (!context) throw new Error("useClientOnboarding must be used inside ClientOnboardingProvider");
  return context;
}
