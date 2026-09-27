"use client";

import Link from "next/link";
import { Card, Spinner } from "@/foundation/ui";
import { useClientBookingsList } from "@/domains/client-bookings/useClientBookingsList";
import { toClientBookingRowViewModel } from "@/domains/client-bookings/viewModel";
import { bookingStatusLabel, paymentStatusLabel } from "@/domains/client-bookings/format";
import { BOOKING_EMPTY_LIST_TITLE, type BookingListTab } from "@/domains/client-bookings/bookingCopy";

const TABS: readonly { value: BookingListTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

/** `/client/bookings` — the client's bookings, grouped by active/closed. */
export function BookingsListView() {
  const { tab, setTab, bookings, loading, error } = useClientBookingsList();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={
              option.value === tab
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
          <p className="text-sm text-neutral-600">{BOOKING_EMPTY_LIST_TITLE[tab]}</p>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {bookings.map((booking) => {
          const row = toClientBookingRowViewModel(booking);
          return (
            <li key={row.id}>
              <Link href={`/client/bookings/${row.id}`} className="block">
                <Card className="transition hover:ring-primary/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900">{row.eventName}</p>
                      <p className="text-sm text-neutral-500">{row.dateLabel}</p>
                      <p className="mt-1 text-sm text-neutral-600">{row.counterpartyLine}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-neutral-900">{row.totalLabel}</p>
                      <p className="mt-1 text-xs font-medium text-primary">{bookingStatusLabel(row.status)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 font-medium text-primary">
                      {paymentStatusLabel(row.paymentStatus)}
                    </span>
                    {row.initiatorBadgeLabel ? (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600">
                        {row.initiatorBadgeLabel}
                      </span>
                    ) : null}
                    {row.hasPriceUpdate ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Price updated</span>
                    ) : null}
                  </div>
                  {row.pendingSubtext ? <p className="mt-2 text-xs text-neutral-500">{row.pendingSubtext}</p> : null}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
