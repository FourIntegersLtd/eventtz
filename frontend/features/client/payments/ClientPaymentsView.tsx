"use client";

import { portalCard } from "@/components/portal-shell/portalTheme";
import Link from "next/link";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { fetchClientBookings, type ClientBookingListItem } from "@/lib/clientBookingsApi";
import { formatEventDate } from "@/lib/dateFormat";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";

async function fetchPaidBookings(): Promise<ClientBookingListItem[]> {
  return fetchClientBookings({
    group: "all",
    exclude_payment_status: "unpaid",
  });
}

export function ClientPaymentsView() {
  const { data: bookings, loading, error } = useReviewsQuery(
    fetchPaidBookings,
    "Could not load payment history.",
  );

  const rows = bookings ?? [];

  if (loading) {
    return <LoadingState label="Loading payment history…" variant="centered" branded className="py-12" />;
  }

  if (error) {
    return <LottieFailureInline message={error} />;
  }

  if (rows.length === 0) {
    return (
      <LottieEmptyPanel
        lottie="emptyInbox"
        title="No paid bookings yet"
        description="When you pay for a booking, it will show up here."
      />
    );
  }

  return (
    <ul className={`divide-y divide-neutral-100 ${portalCard}`}>
      {rows.map((b) => (
        <li key={b.id}>
          <Link
            href={`/client/bookings/${b.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-neutral-50/80"
          >
            <div className="min-w-0">
              <p className="font-medium text-neutral-900">{b.event_name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {b.vendor_display_name}
                {b.event_date ? ` · ${formatEventDate(b.event_date)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums text-neutral-900">
                {b.client_total_label ?? b.total_label}
              </span>
              <PaymentStatusBadge status={b.payment_status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
