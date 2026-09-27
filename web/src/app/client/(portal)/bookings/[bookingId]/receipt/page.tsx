import { ClientReceiptView } from "@/domains/receipts/ClientReceiptView";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/** `/client/bookings/[bookingId]/receipt` — payment receipt for a paid booking. */
export default async function ClientReceiptPage({ params }: PageProps) {
  const { bookingId } = await params;
  return <ClientReceiptView bookingId={bookingId} />;
}
