import { AdminShell } from "@/capabilities/admin-shell";
import { AdminSettingsView } from "@/domains/admin-settings/AdminSettingsView";

/** `/admin/settings` — thin route wrapper. */
export default function AdminSettingsPage() {
  return (
    <AdminShell title="Settings">
      <AdminSettingsView />
    </AdminShell>
  );
}
