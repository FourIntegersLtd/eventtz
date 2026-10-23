"use client";

import Link from "next/link";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import type { BookingListTab } from "@/features/bookings/bookingListConstants";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { TablePagination } from "@/components/ui/TablePagination";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import type { Tone } from "@/lib/tone";

/** Whose bookings the list shows: it decides the wording, the counterparty column and where a row links. */
export type BookingsListPerspective = "client" | "vendor";

/** What differs between the client and the vendor list. */
type PerspectiveConfig = {
  searchId: string;
  searchLabel: string;
  counterpartyHeading: string;
  detailHref: (bookingId: string) => string;
  /** The vendor list is a page of its own, so it brings its own header and a count on the active tab. */
  showPageHeader: boolean;
};

const PERSPECTIVE_CONFIG: Record<BookingsListPerspective, PerspectiveConfig> = {
  client: {
    searchId: "client-bookings-search",
    searchLabel: "Search by vendor or event",
    counterpartyHeading: "Vendor",
    detailHref: (bookingId) => `/client/bookings/${bookingId}`,
    showPageHeader: false,
  },
  vendor: {
    searchId: "vendor-bookings-search",
    searchLabel: "Search by client or event",
    counterpartyHeading: "Client",
    detailHref: (bookingId) => `/vendor/bookings/${encodeURIComponent(bookingId)}`,
    showPageHeader: true,
  },
};

/** Badge tone for a booking status label. */
function statusBadgeTone(status: string): Tone {
  const normalized = status.toLowerCase();
  if (normalized.includes("pending")) return "warning";
  if (normalized.includes("paid") || normalized.includes("complete")) return "success";
  if (normalized.includes("declin") || normalized.includes("cancel")) return "neutral";
  return "info";
}

type BookingsEzListProps = {
  perspective: BookingsListPerspective;
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

/** The bookings table for either side (design C10 and V16): tabs, search, rows that link to the detail page, paging. */
export function BookingsEzList({
  perspective,
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
}: BookingsEzListProps) {
  const config = PERSPECTIVE_CONFIG[perspective];
  return (
    <div className="ez-stack ez-stack--lg">
      {config.showPageHeader ? (
        <PageHeader
          descriptionSize="body"
          eyebrow="Work"
          title="Bookings"
          description="Respond to enquiries and manage confirmed events."
        />
      ) : null}

      <div className="ez-tabs" role="tablist">
        <button
          type="button"
          className={`ez-tab${tab === "active" ? " ez-tab--active" : ""}`}
          onClick={() => onTabChange("active")}
        >
          Active
          {config.showPageHeader && tab === "active" ? (
            <span className="ez-tab__count">{rows.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          className={`ez-tab${tab === "closed" ? " ez-tab--active" : ""}`}
          onClick={() => onTabChange("closed")}
        >
          Closed
        </button>
      </div>

      <EzListFilterToolbar
        searchId={config.searchId}
        searchValue={listSearch}
        onSearchChange={onListSearchChange}
        searchPlaceholder={config.searchLabel}
        searchMaxWidth="18rem"
      />

      {error ? <p className="ez-small" role="alert">{error}</p> : null}
      {loading ? <p className="ez-small">Loading bookings…</p> : null}

      {!loading && rows.length === 0 ? (
        perspective === "client" ? (
          <EmptyState title={emptyTitle} variant="bookings" />
        ) : (
          <p className="ez-small">{emptyTitle}</p>
        )
      ) : (
        <div className="ez-table-wrap">
          <table className="ez-table">
            <thead>
              <tr>
                <th>{config.counterpartyHeading}</th>
                <th>Event</th>
                <th>Date</th>
                <th className="ez-td-status">Status</th>
                <th className="ez-td-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = config.detailHref(row.id);
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
                        <Badge tone={statusBadgeTone(row.status)}>{row.status}</Badge>
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
