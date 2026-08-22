"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminReportBugView } from "@/features/admin/report-bug/AdminReportBugView";

export default function AdminReportBugPage() {
  return (
    <AdminConsolePage title="Report a bug">
      <AdminReportBugView />
    </AdminConsolePage>
  );
}
