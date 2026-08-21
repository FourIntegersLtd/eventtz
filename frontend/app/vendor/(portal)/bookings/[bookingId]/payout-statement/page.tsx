"use client";

import { useParams } from "next/navigation";
import { VendorPayoutStatementView } from "@/features/receipts/VendorPayoutStatementView";

export default function VendorPayoutStatementPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  if (!bookingId) return null;
  return <VendorPayoutStatementView bookingId={bookingId} />;
}
