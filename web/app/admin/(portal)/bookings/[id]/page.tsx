"use client";

import { useParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminBookingDetailView } from "@/features/admin/bookings/AdminBookingDetailView";

export default function AdminBookingDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  return (
    <AdminConsolePage title="Booking" showPageHead={false}>
      {id ? (
        <AdminBookingDetailView bookingId={id} />
      ) : (
        <p className="text-sm text-ink-2">Invalid id.</p>
      )}
    </AdminConsolePage>
  );
}
