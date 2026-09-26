"use client";

import Link from "next/link";
import { Card, Spinner } from "@/foundation/ui";
import { useVendorBookingsList } from "@/domains/vendor-bookings/useVendorBookingsList";
import { bookingStatusLabel, formatEventDate, initiatorLabel, paymentStatusLabel } from "@/domains/vendor-bookings/format";
import type { VendorBookingListItem, VendorBookingsListGroup } from "@/domains/vendor-bookings/api";

const GROUPS: readonly { value: VendorBookingsListGroup; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

/** `/vendor/bookings` — every booking the vendor is party to, grouped by bucket. */
export function BookingsListView() {
  const { group, setGroup, bookings, loading, error } = useVendorBookingsList();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {GROUPS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setGroup(option.value)}
            className={
              option.value === group
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full bg-primary-soft px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary-muted"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? <Spinner label="Loading bookings…" /> : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>
      ) : null}

      {!loading && !error && bookings.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-600">No bookings in this list yet.</p>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {bookings.map((booking) => (
          <BookingRow key={booking.booking_request_id} booking={booking} />
        ))}
      </ul>
    </div>
  );
}

/** One booking's summary row, linking to its detail page. */
function BookingRow({ booking }: { booking: VendorBookingListItem }) {
  return (
    <li>
      <Link href={`/vendor/bookings/${booking.booking_request_id}`} className="block">
        <Card className="transition hover:ring-primary/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-900">{booking.event_name}</p>
              <p className="text-sm text-neutral-500">{formatEventDate(booking.event_date)}</p>
              <p className="mt-1 text-sm text-neutral-600">{booking.client_display_name ?? booking.client_email ?? "Client"}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold text-neutral-900">{booking.client_total_label ?? booking.total_label}</p>
              <p className="mt-1 text-xs font-medium text-primary">{bookingStatusLabel(booking.booking_status)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-primary-soft px-2.5 py-1 font-medium text-primary">
              {paymentStatusLabel(booking.payment_status)}
            </span>
            {booking.initiator ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600">
                {initiatorLabel(booking.initiator)}
              </span>
            ) : null}
            {booking.has_price_update ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Price updated</span>
            ) : null}
            {booking.review ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600">
                {booking.review.rating}/5 · {booking.review.reviewer_display}
              </span>
            ) : null}
          </div>
        </Card>
      </Link>
    </li>
  );
}
