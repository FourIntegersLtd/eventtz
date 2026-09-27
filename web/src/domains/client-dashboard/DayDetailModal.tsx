"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatEventDate } from "@/domains/client-dashboard/dashboardStats";
import type { ClientBookingListItem } from "@/domains/client-dashboard/api";

type Props = {
  dateKey: string;
  bookings: readonly ClientBookingListItem[];
  onClose: () => void;
};

/**
 * The day-detail dialog: every accepted upcoming booking on one calendar day,
 * opened by tapping an active calendar cell. Dismisses on Escape, the
 * backdrop, or the Close button.
 */
export function DayDetailModal({ dateKey, bookings, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const title = `Bookings on ${formatEventDate(dateKey)}`;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-neutral-500 transition hover:text-neutral-900">
            Close
          </button>
        </div>

        <div className="p-5">
          {bookings.length === 0 ? (
            <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-700">
              No bookings on this day.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {bookings.map((booking) => (
                <li key={booking.booking_request_id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{booking.event_name}</p>
                      <p className="mt-0.5 text-sm text-neutral-600">{booking.vendor_display_name}</p>
                      {booking.event_end_date ? (
                        <p className="mt-0.5 text-xs text-neutral-500">Runs to {formatEventDate(booking.event_end_date)}</p>
                      ) : null}
                    </div>
                    <Link
                      href={`/client/bookings/${encodeURIComponent(booking.booking_request_id)}`}
                      onClick={onClose}
                      className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      Open details
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
