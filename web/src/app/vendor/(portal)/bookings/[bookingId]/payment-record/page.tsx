import { VendorPaymentRecordView } from "@/domains/receipts/VendorPaymentRecordView";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/** `/vendor/bookings/[bookingId]/payment-record` — vendor payment record. */
export default async function VendorPaymentRecordPage({ params }: PageProps) {
  const { bookingId } = await params;
  return <VendorPaymentRecordView bookingId={bookingId} />;
}
