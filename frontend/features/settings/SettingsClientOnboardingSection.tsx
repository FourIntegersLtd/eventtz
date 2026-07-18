"use client";

import { Route } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useClientOnboarding } from "@/features/client/onboarding/ClientOnboardingProvider";

export function SettingsClientOnboardingSection() {
  const { openReplay } = useClientOnboarding();

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Tour</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">See how Eventtz works.</p>
        </div>
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
      </div>
    </section>
  );
}
