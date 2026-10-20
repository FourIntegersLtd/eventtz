"use client";

import { VendorReceiptEzPage } from "@/features/receipts/VendorReceiptEzPage";
import { fetchVendorPaymentRecord } from "@/lib/receiptsApi";

type VendorPaymentRecordViewProps = {
  bookingId: string;
};

export function VendorPaymentRecordView({ bookingId }: VendorPaymentRecordViewProps) {
  return <VendorReceiptEzPage bookingId={bookingId} load={fetchVendorPaymentRecord} />;
}
