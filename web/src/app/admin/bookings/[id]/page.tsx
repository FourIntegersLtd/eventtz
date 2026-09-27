import { AdminShell } from "@/capabilities/admin-shell";
import { AdminBookingDetailView } from "@/domains/admin-bookings/AdminBookingDetailView";

/** `/admin/bookings/[id]` — thin route wrapper. */
export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Booking detail">
      <AdminBookingDetailView bookingId={id} />
    </AdminShell>
  );
}
