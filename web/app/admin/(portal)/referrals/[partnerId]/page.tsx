"use client";

import { use } from "react";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminReferralSignupsView } from "@/features/admin/referrals/AdminReferralSignupsView";

type PageProps = {
  params: Promise<{ partnerId: string }>;
};

export default function AdminReferralPartnerPage({ params }: PageProps) {
  const { partnerId } = use(params);
  return (
    <AdminConsolePage title="Creator signups">
      <AdminReferralSignupsView partnerId={partnerId} />
    </AdminConsolePage>
  );
}
