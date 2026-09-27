import { AdminShell } from "@/capabilities/admin-shell";
import { AdminDashboardView } from "@/domains/admin-dashboard/AdminDashboardView";

/** `/admin/dashboard` — thin route wrapper. */
export default function AdminDashboardPage() {
  return (
    <AdminShell title="Dashboard">
      <AdminDashboardView />
    </AdminShell>
  );
}
