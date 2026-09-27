"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Card, LoadingState } from "@/foundation/ui";
import { CopilotPanel } from "@/capabilities/vendor-copilot-panel/CopilotPanel";
import { fetchActiveBookings, type VendorBookingListItem } from "@/domains/vendor-dashboard/api";
import { activeBookingsCount, pendingBookingsCount, upcomingAgenda } from "@/domains/vendor-dashboard/dashboardStats";

/** One "waiting on you" row: a pending booking the vendor has not replied to yet. */
function NeedsResponseRow({ booking }: { booking: VendorBookingListItem }) {
  return (
    <li>
      <Link
        href={`/vendor/bookings/${encodeURIComponent(booking.booking_request_id)}`}
        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-primary-soft/50"
      >
        <span className="min-w-0 truncate font-medium text-neutral-900">{booking.event_name}</span>
        <span className="shrink-0 text-amber-600">Waiting for your reply</span>
      </Link>
    </li>
  );
}

/** One upcoming-event row for the agenda list. */
function AgendaRow({ booking }: { booking: VendorBookingListItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 truncate text-neutral-800">{booking.event_name}</span>
      <span className="shrink-0 text-neutral-500">{booking.event_date}</span>
    </li>
  );
}

/**
 * The vendor dashboard: a snapshot of active/pending bookings, an upcoming
 * agenda, and the growth co-pilot. Ported (simplified) from the baseline's
 * `VendorDashboardView` — the calendar grid, day-detail modal, and
 * payout-setup banner are left to the bookings/payments workstreams that own
 * those routes.
 */
export function DashboardView() {
  const [bookings, setBookings] = useState<VendorBookingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchActiveBookings();
        if (!cancelled) setBookings(result);
      } catch (cause: unknown) {
        if (!cancelled) setError(platformErrorDetail(cause) ?? "Could not load your bookings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState variant="inline" label="Loading your dashboard…" />;
  }

  const activeBookings = bookings ?? [];
  const needsResponse = activeBookings.filter((booking) => booking.booking_status === "pending");
  const agenda = upcomingAgenda(activeBookings, new Date());

  return (
    <div className="w-full max-w-full space-y-6">
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/vendor/bookings?tab=active" className="block transition hover:shadow-md">
          <Card padding="lg">
            <p className="text-sm font-medium text-neutral-500">Active bookings</p>
            <p className="mt-3 text-3xl font-semibold text-neutral-900">{activeBookingsCount(activeBookings)}</p>
          </Card>
        </Link>
        <Link href="/vendor/bookings?tab=active&status=pending" className="block transition hover:shadow-md">
          <Card padding="lg">
            <p className="text-sm font-medium text-neutral-500">Pending response</p>
            <p className={`mt-3 text-3xl font-semibold ${pendingBookingsCount(activeBookings) > 0 ? "text-amber-600" : "text-neutral-900"}`}>
              {pendingBookingsCount(activeBookings)}
            </p>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <Card padding="lg">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">Needs your attention</h2>
            {needsResponse.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Nothing waiting on you right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100">
                {needsResponse.map((booking) => (
                  <NeedsResponseRow key={booking.booking_request_id} booking={booking} />
                ))}
              </ul>
            )}
          </Card>

          <Card padding="lg">
            <h2 className="font-heading text-lg font-semibold text-neutral-900">Upcoming events</h2>
            {agenda.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No upcoming events booked yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100">
                {agenda.map((booking) => (
                  <AgendaRow key={booking.booking_request_id} booking={booking} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-1">
          <CopilotPanel />
        </div>
      </div>
    </div>
  );
}
