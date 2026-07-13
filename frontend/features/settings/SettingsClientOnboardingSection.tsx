"use client";

import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { Route } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useClientOnboarding } from "@/features/client/onboarding/ClientOnboardingProvider";

export function SettingsClientOnboardingSection() {
  const { openReplay } = useClientOnboarding();

  return (
    <section className={`${portalCard} ${portalCardPadding}`}>
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Tour</h2>
      <p className="mt-1 text-sm text-neutral-500">See how Eventtz works.</p>
      <Button
        type="button"
        variant="secondary"
        className="mt-4 w-full gap-2 sm:w-auto"
        onClick={openReplay}
      >
        <Route className="h-4 w-4 shrink-0" aria-hidden />
        Show tour again
      </Button>
    </section>
  );
}
