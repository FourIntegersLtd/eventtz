import { AdminShell } from "@/capabilities/admin-shell";
import { AdminAuditDetailView } from "@/domains/admin-audit/AdminAuditDetailView";

/** `/admin/audit/[id]` — thin route wrapper. */
export default async function AdminAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Activity detail">
      <AdminAuditDetailView entryId={id} />
    </AdminShell>
  );
}
