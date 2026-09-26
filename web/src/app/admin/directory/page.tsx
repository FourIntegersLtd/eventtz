import { AdminShell } from "@/capabilities/admin-shell";
import { AdminDirectoryView } from "@/domains/admin-directory/AdminDirectoryView";

/** `/admin/directory` — thin route wrapper. */
export default function AdminDirectoryPage() {
  return (
    <AdminShell title="Directory">
      <AdminDirectoryView />
    </AdminShell>
  );
}
