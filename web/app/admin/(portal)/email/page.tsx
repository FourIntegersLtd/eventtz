"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminEmailTestingView } from "@/features/admin/email/AdminEmailTestingView";

export default function AdminEmailTestingPage() {
  return (
    <AdminConsolePage

      title="Email health"
      description="Super admin only · last 7 days. Confirm Resend delivery and preview email layouts with your own message text."
    >
      <AdminEmailTestingView />
    </AdminConsolePage>
  );
}
