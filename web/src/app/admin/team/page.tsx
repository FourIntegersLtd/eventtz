import { AdminShell } from "@/capabilities/admin-shell";
import { AdminTeamView } from "@/domains/admin-team/AdminTeamView";

/** `/admin/team` — thin route wrapper. */
export default function AdminTeamPage() {
  return (
    <AdminShell title="Admin team">
      <AdminTeamView />
    </AdminShell>
  );
}
