"use client";

import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { PaymentStatusBadge } from "@/components/badges/PaymentStatusBadge";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import {
  AdminBookingsFilterModal,
  bookingStatusFilterLabel,
  eventDatesFilterSummary,
} from "@/features/admin/bookings/AdminBookingsFilterModal";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { DataTable } from "@/components/ui/DataTable";
import { useAdminBookings } from "@/features/admin/bookings/useAdminBookings";
import type { AdminBookingListItem } from "@/lib/adminPlatformApi";

function bookingRef(id: string): string {
  const tail = id.replace(/-/g, "").slice(-5).toUpperCase();
  return `EZ-${tail}`;
}

function supportRowClass(support: AdminBookingListItem["support"]): string | undefined {
  if (!support?.needs_attention_count) return undefined;
  return support.max_severity === "critical" ? "bg-red-50/50" : "bg-amber-50/40";
}

export function AdminBookingsView() {
  const searchParams = useSearchParams();
  const initialStatus = useMemo(() => searchParams.get("status") ?? "", [searchParams]);
  const initialNeedsAttention = useMemo(
    () => searchParams.get("needs_attention") === "1",
    [searchParams],
  );

  const {
    rows,
    total,
    offset,
    limit,
    setOffset,
    loading,
    error,
    status,
    setStatus,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    needsAttentionOnly,
    setNeedsAttentionOnly,
    reload,
  } = useAdminBookings({ status: initialStatus, needs_attention: initialNeedsAttention });

  const [filterOpen, setFilterOpen] = useState(false);

  const maxOffset = Math.max(0, total - limit);
  const datesActive = Boolean(dateFrom) || Boolean(dateTo);
  const datesLabel = eventDatesFilterSummary(dateFrom, dateTo);
  const modalFilterActive = datesActive || Boolean(status);
  const activeFilterCount = (datesActive ? 1 : 0) + (status ? 1 : 0);

  const hasActiveFilters =
    Boolean(status) ||
    Boolean(search.trim()) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    needsAttentionOnly;

  const clearFilters = () => {
    setOffset(0);
    setStatus("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setNeedsAttentionOnly(false);
  };

  return (
    <div className="ez-stack min-w-0 max-w-full">
      {error ? <AdminErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <EzListFilterToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setOffset(0);
          setSearch(value);
        }}
        searchPlaceholder="Search event name"
        searchAriaLabel="Search event name"
        onOpenFilter={() => setFilterOpen(true)}
        activeFilterCount={activeFilterCount}
        summary={
          modalFilterActive
            ? {
                label: [datesActive ? datesLabel : null, status ? bookingStatusFilterLabel(status) : null]
                  .filter(Boolean)
                  .join(" · "),
                onClear: () => {
                  setOffset(0);
                  setDateFrom("");
                  setDateTo("");
                  setStatus("");
                },
              }
            : null
        }
      />

      <AdminBookingsFilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(value) => {
          setOffset(0);
          setDateFrom(value);
        }}
        onDateToChange={(value) => {
          setOffset(0);
          setDateTo(value);
        }}
        status={status}
        onStatusChange={(id) => {
          setOffset(0);
          setStatus(id);
        }}
        hasActiveFilters={modalFilterActive}
        onClearAll={() => {
          setOffset(0);
          setDateFrom("");
          setDateTo("");
          setStatus("");
        }}
      />

      {loading ? (
        <AdminLoadingState label="Loading bookings…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No bookings match your filters"
          lottie="searchNoResults"
          action={
            hasActiveFilters ? (
              <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            aria-label="Bookings"
            tableClassName="min-w-[68rem]"
            rows={rows}
            getRowKey={(row) => row.id}
            rowClassName={(row) => supportRowClass(row.support)}
            columns={[
              { key: "ref", header: "Ref", kind: "strong", cell: (row) => bookingRef(row.id) },
              { key: "event", header: "Event", className: "text-ink", cell: (row) => row.event_name || "-" },
              {
                key: "client",
                header: "Client",
                className: "max-w-[10rem] truncate text-ink-2",
                cell: (row) => row.client_email ?? "-",
              },
              {
                key: "vendor",
                header: "Vendor",
                cell: (row) => (
                  <>
                    <div className="font-medium text-ink">{row.vendor_display_name}</div>
                    {row.vendor_email ? <div className="text-xs text-ink-3">{row.vendor_email}</div> : null}
                  </>
                ),
              },
              { key: "date", header: "Event date", className: "text-ink-2", cell: (row) => row.event_date || "-" },
              {
                key: "total",
                header: "Total",
                kind: "num",
                className: "text-ink-2",
                cell: (row) => row.client_total_label ?? "-",
              },
              {
                key: "request",
                header: "Request",
                kind: "status",
                cell: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: "payment",
                header: "Payment",
                kind: "status",
                cell: (row) => <PaymentStatusBadge status={row.payment_status} />,
              },
              {
                key: "support",
                header: " ",
                cell: (row) => (
                  <ButtonLink href={`/admin/bookings/${row.id}`} variant="secondary" size="sm">
                    Support
                  </ButtonLink>
                ),
              },
            ]}
          />
          <TablePagination
            offset={offset}
            limit={limit}
            total={total}
            pageRowCount={rows.length}
            loading={loading}
            onPrevious={() => setOffset(Math.max(0, offset - limit))}
            onNext={() => setOffset(Math.min(maxOffset, offset + limit))}
          />
        </>
      )}
    </div>
  );
}
