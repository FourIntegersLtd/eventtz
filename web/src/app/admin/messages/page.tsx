import { AdminShell } from "@/capabilities/admin-shell";
import { AdminMessagesView } from "@/domains/admin-messages/AdminMessagesView";

/** `/admin/messages` — thin route wrapper. */
export default function AdminMessagesPage() {
  return (
    <AdminShell title="Messages">
      <AdminMessagesView />
    </AdminShell>
  );
}
