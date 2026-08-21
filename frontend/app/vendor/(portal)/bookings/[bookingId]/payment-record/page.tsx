"use client";

import { useParams } from "next/navigation";
import { VendorPaymentRecordView } from "@/features/receipts/VendorPaymentRecordView";

export default function VendorPaymentRecordPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  if (!bookingId) return null;
  return <VendorPaymentRecordView bookingId={bookingId} />;
}
