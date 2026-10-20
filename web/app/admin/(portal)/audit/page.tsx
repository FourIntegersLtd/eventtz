"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminAuditView } from "@/features/admin/audit/AdminAuditView";

export default function AdminAuditPage() {
  return (
    <AdminConsolePage title="Activity log" description="Every staff action is recorded.">
      <AdminAuditView />
    </AdminConsolePage>
  );
}
