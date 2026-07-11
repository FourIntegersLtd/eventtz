"use client";

import Link from "next/link";
import { LoadingState } from "@/components/ui/LoadingState";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { fetchClientBookings, type ClientBookingListItem } from "@/lib/clientBookingsApi";
import { formatEventDate } from "@/lib/dateFormat";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";

async function fetchPaidBookings(): Promise<ClientBookingListItem[]> {
  const [active, closed] = await Promise.all([
    fetchClientBookings("active"),
    fetchClientBookings("closed"),
  ]);
  return [...active, ...closed].filter((b) => b.payment_status !== "unpaid");
}

export function ClientPaymentsView() {
  const { data: bookings, loading, error } = useReviewsQuery(
    fetchPaidBookings,
    "Could not load payment history.",
  );

  const rows = bookings ?? [];

  return (
    <div className="w-full max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-neutral-600">
          Bookings where payment has been initiated or completed. Open a booking for full details.
        </p>
      </header>

      {loading ? (
        <LoadingState label="Loading payment history…" variant="inline" />
      ) : error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 px-5 py-10 text-center text-sm text-neutral-600">
          No paid bookings yet.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/50">
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
      )}
    </div>
  );
}
