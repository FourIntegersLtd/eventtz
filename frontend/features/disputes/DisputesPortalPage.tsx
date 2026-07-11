"use client";

import type { PortalRole } from "@/components/portal-shell/portalNav";
import { ParticipantDisputesPortalView } from "@/features/disputes/ParticipantDisputesPortalView";

type DisputesPortalPageProps = {
  role: PortalRole;
  selectedDisputeId?: string | null;
};

export function DisputesPortalPage({ role, selectedDisputeId = null }: DisputesPortalPageProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        All disputes on your bookings, and any you&apos;ve raised yourself. Select a row to view
        details.
      </p>
      <ParticipantDisputesPortalView role={role} selectedDisputeId={selectedDisputeId} />
    </div>
  );
}
