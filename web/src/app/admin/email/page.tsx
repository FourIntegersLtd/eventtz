import { AdminShell } from "@/capabilities/admin-shell";
import { AdminEmailTestingView } from "@/domains/admin-email/AdminEmailTestingView";

/** `/admin/email` — thin route wrapper. */
export default function AdminEmailPage() {
  return (
    <AdminShell title="Email health">
      <AdminEmailTestingView />
    </AdminShell>
  );
}
