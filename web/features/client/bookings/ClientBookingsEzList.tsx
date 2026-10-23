"use client";

import Link from "next/link";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import type { BookingListTab } from "@/features/bookings/BookingListPanel";
import { TablePagination } from "@/components/ui/TablePagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import { TextField } from "@/components/ui/TextField";

function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("pending")) return "ez-badge--warning";
  if (normalized.includes("paid") || normalized.includes("complete")) return "ez-badge--success";
  if (normalized.includes("declin") || normalized.includes("cancel")) return "ez-badge--neutral";
  return "ez-badge--info";
}

function clientBookingDetailHref(id: string): string {
  return `/client/bookings/${id}`;
}

type ClientBookingsEzListProps = {
  tab: BookingListTab;
  onTabChange: (tab: BookingListTab) => void;
  rows: BookingListRowViewModel[];
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  listOffset?: number;
  listPageSize?: number;
  listTotal?: number;
  onListPrevious?: () => void;
  onListNext?: () => void;
  listSearch?: string;
  onListSearchChange?: (value: string) => void;
};

/** Client bookings list — same table layout as vendor `VendorBookingsEzList`. */
export function ClientBookingsEzList({
  tab,
  onTabChange,
  rows,
  loading,
  error,
  emptyTitle,
  listOffset = 0,
  listPageSize = DEFAULT_LIST_PAGE_SIZE,
  listTotal = 0,
  onListPrevious,
  onListNext,
  listSearch = "",
  onListSearchChange,
}: ClientBookingsEzListProps) {
  return (
    <div className="ez-stack ez-stack--lg">
      <div className="ez-tabs" role="tablist">
        <button
          type="button"
          className={`ez-tab${tab === "active" ? " ez-tab--active" : ""}`}
          onClick={() => onTabChange("active")}
        >
          Active
        </button>
        <button
          type="button"
          className={`ez-tab${tab === "closed" ? " ez-tab--active" : ""}`}
          onClick={() => onTabChange("closed")}
        >
          Closed
        </button>
      </div>

      <div className="ez-hrow">
        <TextField
          id="client-bookings-search"
          type="search"
          label="Search by vendor or event"
          hideLabel
          value={listSearch}
          placeholder="Search by vendor or event"
          wrapperStyle={{ width: "min(18rem, 100%)" }}
          onChange={(event) => onListSearchChange?.(event.target.value)}
          onClear={() => onListSearchChange?.("")}
        />
      </div>

      {error ? <p className="ez-small" role="alert">{error}</p> : null}
      {loading ? <p className="ez-small">Loading bookings…</p> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState title={emptyTitle} variant="bookings" />
      ) : (
        <div className="ez-table-wrap">
          <table className="ez-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Event</th>
                <th>Date</th>
                <th className="ez-td-status">Status</th>
                <th className="ez-td-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = clientBookingDetailHref(row.id);
                return (
                  <tr key={row.id}>
                    <td className="ez-td-strong">
                      <Link className="ez-table__celllink" href={href}>{row.counterpartyLine}</Link>
                    </td>
                    <td>
                      <Link className="ez-table__celllink" href={href}>{row.eventName}</Link>
                    </td>
                    <td>
                      <Link className="ez-table__celllink" href={href}>{row.dateLabel}</Link>
                    </td>
                    <td className="ez-td-status">
                      <Link className="ez-table__celllink" href={href}>
                        <span className={`ez-badge ${statusBadgeClass(row.status)}`}>{row.status}</span>
                      </Link>
                    </td>
                    <td className="ez-td-num">
                      <Link className="ez-table__celllink" href={href}>{row.totalLabel}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {onListPrevious && onListNext ? (
        <TablePagination
          offset={listOffset}
          limit={listPageSize}
          total={listTotal}
          pageRowCount={rows.length}
          loading={loading}
          onPrevious={onListPrevious}
          onNext={onListNext}
        />
      ) : null}
    </div>
  );
}
