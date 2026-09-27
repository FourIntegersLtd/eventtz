import { AdminShell } from "@/capabilities/admin-shell";
import { AdminReferralPartnerDetailView } from "@/domains/admin-referrals/AdminReferralPartnerDetailView";

/** `/admin/referrals/[partnerId]` — thin route wrapper. */
export default async function AdminReferralPartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  return (
    <AdminShell title="Partner signups">
      <AdminReferralPartnerDetailView partnerId={partnerId} />
    </AdminShell>
  );
}
