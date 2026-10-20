"use client";

import Link from "next/link";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import type { BookingListTab } from "@/features/bookings/BookingListPanel";
import { vendorBookingDetailHref } from "@/features/vendor/bookings/vendorBookingViewModel";
import { TablePagination } from "@/components/ui/TablePagination";
import { VendorEzPageHead } from "@/features/vendor/ui/VendorEzPageHead";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import { EzClearableInput } from "@/components/ui/EzClearableInput";

function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("pending")) return "ez-badge--warning";
  if (normalized.includes("paid") || normalized.includes("complete")) return "ez-badge--success";
  if (normalized.includes("declin") || normalized.includes("cancel")) return "ez-badge--neutral";
  return "ez-badge--info";
}

type VendorBookingsEzListProps = {
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

/** Live bookings list (design V16): the table only. Each row is a link to its own detail page. */
export function VendorBookingsEzList({
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
}: VendorBookingsEzListProps) {
  return (
    <div className="ez-stack ez-stack--lg">
      <VendorEzPageHead
        eyebrow="Work"
        title="Bookings"
        description="Respond to enquiries and manage confirmed events."
      />

      <div className="ez-tabs" role="tablist">
        <button
          type="button"
          className={`ez-tab${tab === "active" ? " ez-tab--active" : ""}`}
          onClick={() => onTabChange("active")}
        >
          Active
          {tab === "active" ? <span className="ez-tab__count">{rows.length}</span> : null}
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
        <EzClearableInput
          id="vendor-bookings-search"
          value={listSearch}
          placeholder="Search by client or event"
          aria-label="Search by client or event"
          wrapperStyle={{ width: "min(18rem, 100%)" }}
          onChange={(value) => onListSearchChange?.(value)}
        />
      </div>

      {error ? <p className="ez-small" role="alert">{error}</p> : null}
      {loading ? <p className="ez-small">Loading bookings…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="ez-small">{emptyTitle}</p>
      ) : (
        <div className="ez-table-wrap">
          <table className="ez-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Event</th>
                <th>Date</th>
                <th className="ez-td-status">Status</th>
                <th className="ez-td-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = vendorBookingDetailHref(row.id);
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
