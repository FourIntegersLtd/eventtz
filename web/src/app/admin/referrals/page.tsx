import { AdminShell } from "@/capabilities/admin-shell";
import { AdminReferralsListView } from "@/domains/admin-referrals/AdminReferralsListView";

/** `/admin/referrals` — thin route wrapper. */
export default function AdminReferralsPage() {
  return (
    <AdminShell title="Referral partners">
      <AdminReferralsListView />
    </AdminShell>
  );
}
