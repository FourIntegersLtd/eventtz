"use client";

import { Button, Card } from "@/foundation/ui";
import { useClientOnboarding } from "@/domains/client-onboarding/ClientOnboardingProvider";

/**
 * The "Tour" control on the client settings page: rerun the welcome tour.
 *
 * Built here rather than in `domains/settings` because it needs the
 * onboarding provider (a domain may not import another). The client settings
 * route passes it into `SettingsView` as a slot; the vendor route passes
 * nothing. The baseline's `Route` icon is dropped — `web/` has no icon library.
 */
export function SettingsClientOnboardingSection() {
  const { openReplay } = useClientOnboarding();

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Tour</h2>
          <p className="mt-1 text-sm text-neutral-500">See how Eventtz works.</p>
        </div>
        <Button type="button" variant="secondary" className="shrink-0" onClick={openReplay}>
          Show tour again
        </Button>
      </div>
    </Card>
  );
}
