"use client";

import { useParams } from "next/navigation";
import { VendorBookingsView } from "@/features/vendor/bookings/VendorBookingsView";

export default function VendorBookingDetailPage() {
  const params = useParams();
  const bookingId = typeof params.bookingId === "string" ? params.bookingId : "";
  return <VendorBookingsView selectedBookingId={bookingId} />;
}
