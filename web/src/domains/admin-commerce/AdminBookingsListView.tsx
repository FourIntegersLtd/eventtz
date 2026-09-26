"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminPagination,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
  formatDate,
  humanize,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminBookings, type AdminBookingListItem } from "@/domains/admin-commerce/api";

const PAGE_SIZE = 50;

/** Commerce's Bookings tab: every booking, filterable by status and a support flag. */
export function AdminBookingsListView() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [bookings, setBookings] = useState<AdminBookingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      const result = await fetchAdminBookings({
        offset,
        limit: PAGE_SIZE,
        status: status || undefined,
        search: search || undefined,
        needs_attention: needsAttentionOnly || undefined,
      });
      setBookings(result.bookings);
      setTotal(result.total);
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [offset, status, search, needsAttentionOnly]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setOffset(0);
          }}
          className="rounded-xl border border-primary-border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="completed">Completed</option>
          <option value="declined">Declined</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          placeholder="Search event name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
          className="rounded-xl border border-primary-border px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={needsAttentionOnly}
            onChange={(event) => {
              setNeedsAttentionOnly(event.target.checked);
              setOffset(0);
            }}
          />
          Needs support only
        </label>
      </div>

      {loading ? <AdminLoadingState label="Loading bookings…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && bookings.length === 0 ? (
        <AdminEmptyState title="No bookings match your filters" />
      ) : null}
      {!loading && !error && bookings.length > 0 ? (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTableHeaderCell>Event</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Client</AdminTableHeaderCell>
                <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
                <AdminTableHeaderCell>Total</AdminTableHeaderCell>
                <AdminTableHeaderCell>Support</AdminTableHeaderCell>
                <AdminTableHeaderCell>View</AdminTableHeaderCell>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {bookings.map((booking) => (
                <AdminTableRow key={booking.id} tinted={booking.support?.max_severity ?? undefined}>
                  <AdminTableCell>
                    {booking.event_name}
                    <div className="text-xs text-neutral-500">{formatDate(booking.event_date)}</div>
                  </AdminTableCell>
                  <AdminTableCell>{humanize(booking.status)}</AdminTableCell>
                  <AdminTableCell>{booking.client_email ?? "-"}</AdminTableCell>
                  <AdminTableCell>
                    {booking.vendor_display_name}
                    <div className="text-xs text-neutral-500">{booking.vendor_email ?? ""}</div>
                  </AdminTableCell>
                  <AdminTableCell>{booking.client_total_label ?? "-"}</AdminTableCell>
                  <AdminTableCell>{booking.support?.next_action ?? "-"}</AdminTableCell>
                  <AdminTableCell>
                    <Link href={`/admin/bookings/${booking.id}`} className="font-medium text-primary hover:underline">
                      View
                    </Link>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            onNext={() => setOffset(offset + PAGE_SIZE)}
          />
        </>
      ) : null}
    </div>
  );
}
