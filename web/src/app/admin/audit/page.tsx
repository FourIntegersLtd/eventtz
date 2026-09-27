import { AdminShell } from "@/capabilities/admin-shell";
import { AdminAuditListView } from "@/domains/admin-audit/AdminAuditListView";

/** `/admin/audit` — thin route wrapper. */
export default function AdminAuditPage() {
  return (
    <AdminShell title="Activity log">
      <AdminAuditListView />
    </AdminShell>
  );
}
