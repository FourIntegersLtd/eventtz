"use client";

import { use } from "react";
import { DisputesPortalPage } from "@/features/disputes/DisputesPortalPage";

type PageProps = {
  params: Promise<{ disputeId: string }>;
};

export default function ClientDisputeDetailPage({ params }: PageProps) {
  const { disputeId } = use(params);
  return <DisputesPortalPage role="client" selectedDisputeId={disputeId} />;
}
