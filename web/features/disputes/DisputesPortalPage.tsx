"use client";

import type { PortalRole } from "@/lib/portalRole";
import { PageHeader } from "@/components/ui/PageHeader";
import { ParticipantDisputesPortalView } from "@/features/disputes/ParticipantDisputesPortalView";

type DisputesPortalPageProps = {
  role: PortalRole;
  selectedDisputeId?: string | null;
};

export function DisputesPortalPage({ role, selectedDisputeId = null }: DisputesPortalPageProps) {
  return (
    <div className="ez-stack ez-stack--lg">
      {role === "client" ? (
        <PageHeader
          title="Help and disputes"
          description="Open a case when something went wrong on a booking."
        />
      ) : (
        <p className="ez-small">Your disputes. Select one for details.</p>
      )}
      <ParticipantDisputesPortalView role={role} selectedDisputeId={selectedDisputeId} />
    </div>
  );
}
