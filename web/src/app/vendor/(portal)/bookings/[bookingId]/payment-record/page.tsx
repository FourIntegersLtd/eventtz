import Link from "next/link";
import { Card } from "@/foundation/ui";

type PageProps = {
  params: Promise<{ bookingId: string }>;
};

/**
 * `/vendor/bookings/[bookingId]/payment-record` — stub.
 *
 * The receipts slice (ws12) that serves this data hasn't merged yet, so
 * this route exists (matching the baseline URL) without inventing payment
 * figures the API can't yet provide.
 */
export default async function VendorPaymentRecordPage({ params }: PageProps) {
  const { bookingId } = await params;
  return (
    <Card>
      <p className="text-sm text-neutral-600">Payment records aren&apos;t available yet.</p>
      <Link href={`/vendor/bookings/${bookingId}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
        Back to the booking
      </Link>
    </Card>
  );
}
