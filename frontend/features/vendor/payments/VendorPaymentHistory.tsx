"use client";

import Link from "next/link";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";
import { formatEventDate } from "@/lib/dateFormat";
import { fetchVendorBookings, type VendorBookingListItem } from "@/lib/vendorBookingsApi";

async function fetchVendorPaymentHistory(): Promise<VendorBookingListItem[]> {
  const rows = await fetchVendorBookings({
    group: "all",
    exclude_payment_status: "unpaid",
  });
  return [...rows].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return bTime - aTime;
  });
}

export function VendorPaymentHistory() {
  const { data: bookings, loading, error } = useReviewsQuery(
    fetchVendorPaymentHistory,
    "Could not load payment history.",
  );

  const rows = bookings ?? [];

  if (loading) {
    return <LoadingState label="Loading payment history…" variant="inline" className="py-10" />;
  }

  if (error) {
    return <LottieFailureInline message={error} />;
  }

  if (rows.length === 0) {
    return (
      <LottieEmptyPanel
        variant="payments"
        title="No payments yet"
        description="When a client pays for a booking, it will show up here with the payout status."
      />
    );
  }

  return (
    <ul className={`divide-y divide-neutral-100 ${portalCard}`}>
      {rows.map((b) => (
        <li key={b.id}>
          <Link
            href={`/vendor/bookings/${b.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-neutral-50/80"
          >
            <div className="min-w-0">
              <p className="font-medium text-neutral-900">{b.event_name}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {b.client_display_name ?? b.client_email ?? "Client"}
                {b.event_date ? ` · ${formatEventDate(b.event_date)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums text-neutral-900">
                {b.total_label}
              </span>
              <PaymentStatusBadge status={b.payment_status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
