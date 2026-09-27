import { VendorPayoutStatementView } from "@/domains/receipts/VendorPayoutStatementView";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/** `/vendor/bookings/[bookingId]/payout-statement` — vendor payout statement. */
export default async function VendorPayoutStatementPage({ params }: PageProps) {
  const { bookingId } = await params;
  return <VendorPayoutStatementView bookingId={bookingId} />;
}
