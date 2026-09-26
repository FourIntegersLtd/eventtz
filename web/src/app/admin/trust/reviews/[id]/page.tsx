import { AdminShell } from "@/capabilities/admin-shell";
import { AdminReviewDetailView } from "@/domains/admin-trust/AdminReviewDetailView";

/** `/admin/trust/reviews/[id]` — thin route wrapper. */
export default async function AdminReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Review moderation">
      <AdminReviewDetailView reviewId={id} />
    </AdminShell>
  );
}
