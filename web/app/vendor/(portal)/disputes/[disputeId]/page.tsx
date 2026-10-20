"use client";

import { use } from "react";
import { VendorDisputesEzView } from "@/features/disputes/VendorDisputesEzView";

type PageProps = {
  params: Promise<{ disputeId: string }>;
};

export default function VendorDisputeDetailPage({ params }: PageProps) {
  const { disputeId } = use(params);
  return <VendorDisputesEzView selectedDisputeId={disputeId} />;
}
