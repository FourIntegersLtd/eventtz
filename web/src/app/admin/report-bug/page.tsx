import { AdminShell } from "@/capabilities/admin-shell";
import { AdminReportBugView } from "@/domains/admin-report-bug/AdminReportBugView";

/** `/admin/report-bug` — thin route wrapper. */
export default function AdminReportBugPage() {
  return (
    <AdminShell title="Report a bug">
      <AdminReportBugView />
    </AdminShell>
  );
}
