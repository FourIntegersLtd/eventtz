import { AdminShell } from "@/capabilities/admin-shell";
import { AdminCommerceView } from "@/domains/admin-commerce/AdminCommerceView";

/** `/admin/commerce` — thin route wrapper. */
export default function AdminCommercePage() {
  return (
    <AdminShell title="Commerce">
      <AdminCommerceView />
    </AdminShell>
  );
}
