"use client";

import { Route } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useClientOnboarding } from "@/features/client/onboarding/ClientOnboardingProvider";
import { SettingsSection } from "./SettingsSection";

export function SettingsClientOnboardingSection() {
  const { openReplay } = useClientOnboarding();

  return (
    <SettingsSection
      title="Tour"
      description="See how Eventtz works."
      trailing={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 gap-2"
          onClick={openReplay}
        >
          <Route className="h-4 w-4 shrink-0" aria-hidden />
          Show tour again
        </Button>
      }
    />
  );
}
