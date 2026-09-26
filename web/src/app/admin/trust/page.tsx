import { AdminShell } from "@/capabilities/admin-shell";
import { AdminTrustView } from "@/domains/admin-trust/AdminTrustView";

/** `/admin/trust` — thin route wrapper. */
export default function AdminTrustPage() {
  return (
    <AdminShell title="Trust and safety">
      <AdminTrustView />
    </AdminShell>
  );
}
