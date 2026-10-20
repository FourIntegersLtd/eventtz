"use client";

import { VendorReceiptEzPage } from "@/features/receipts/VendorReceiptEzPage";
import { fetchVendorPayoutStatement } from "@/lib/receiptsApi";

type VendorPayoutStatementViewProps = {
  bookingId: string;
};

export function VendorPayoutStatementView({ bookingId }: VendorPayoutStatementViewProps) {
  return <VendorReceiptEzPage bookingId={bookingId} load={fetchVendorPayoutStatement} />;
}
