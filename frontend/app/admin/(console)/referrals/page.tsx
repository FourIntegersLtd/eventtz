"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminReferralsView } from "@/features/admin/referrals/AdminReferralsView";

export default function AdminReferralsPage() {
  return (
    <AdminConsolePage title="Referrals">
      <AdminReferralsView />
    </AdminConsolePage>
  );
}
