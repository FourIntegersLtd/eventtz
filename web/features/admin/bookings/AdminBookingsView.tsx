"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { PaymentStatusBadge } from "@/components/badges/PaymentStatusBadge";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import { adminFilterControlClass } from "@/features/admin/components/adminFilterControlClass";
import {
  AdminBookingsFilterModal,
  bookingStatusFilterLabel,
  eventDatesFilterSummary,
} from "@/features/admin/bookings/AdminBookingsFilterModal";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
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
        inputClassName={adminFilterControlClass}
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
              <button type="button" className="ez-btn ez-btn--secondary ez-btn--sm" onClick={clearFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <AdminTable>
            <AdminTableElement className="min-w-[68rem]">
              <AdminTableHead>
                <AdminTableHeaderCell>Ref</AdminTableHeaderCell>
                <AdminTableHeaderCell>Event</AdminTableHeaderCell>
                <AdminTableHeaderCell>Client</AdminTableHeaderCell>
                <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
                <AdminTableHeaderCell>Event date</AdminTableHeaderCell>
                <AdminTableHeaderCell className="ez-td-num">Total</AdminTableHeaderCell>
                <AdminTableHeaderCell className="ez-td-status">Request</AdminTableHeaderCell>
                <AdminTableHeaderCell className="ez-td-status">Payment</AdminTableHeaderCell>
                <AdminTableHeaderCell> </AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {rows.map((r) => (
                  <AdminTableRow key={r.id} className={supportRowClass(r.support)}>
                    <AdminTableCell className="ez-td-strong">{bookingRef(r.id)}</AdminTableCell>
                    <AdminTableCell className="text-neutral-900">{r.event_name || "-"}</AdminTableCell>
                    <AdminTableCell className="max-w-[10rem] truncate text-neutral-700">
                      {r.client_email ?? "-"}
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="font-medium text-neutral-800">{r.vendor_display_name}</div>
                      {r.vendor_email ? (
                        <div className="text-xs text-neutral-500">{r.vendor_email}</div>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell className="text-neutral-700">{r.event_date || "-"}</AdminTableCell>
                    <AdminTableCell className="ez-td-num text-neutral-700">
                      {r.client_total_label ?? "-"}
                    </AdminTableCell>
                    <AdminTableCell className="ez-td-status">
                      <StatusBadge status={r.status} />
                    </AdminTableCell>
                    <AdminTableCell className="ez-td-status">
                      <PaymentStatusBadge status={r.payment_status} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <Link href={`/admin/bookings/${r.id}`} className="ez-btn ez-btn--secondary ez-btn--sm">
                        Support
                      </Link>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminTableElement>
          </AdminTable>
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
