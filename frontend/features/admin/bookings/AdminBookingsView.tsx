"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
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

const STATUSES = ["", "pending", "accepted", "completed", "declined", "cancelled"];

export function AdminBookingsView() {
  const searchParams = useSearchParams();
  const initialStatus = useMemo(() => searchParams.get("status") ?? "", [searchParams]);

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
  } = useAdminBookings({ status: initialStatus });

  const maxOffset = Math.max(0, total - limit);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}

      <AdminPageHeader />

      <AdminFilterBar>
        <label className="block text-sm">
          <span className="text-neutral-600">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setOffset(0);
              setStatus(e.target.value);
            }}
            className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm sm:w-44"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s : "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[12rem] flex-1 text-sm">
          <span className="text-neutral-600">Search event name</span>
          <input
            value={search}
            onChange={(e) => {
              setOffset(0);
              setSearch(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Contains…"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-600">Created from</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setOffset(0);
              setDateFrom(e.target.value);
            }}
            className="mt-1 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-600">Created to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setOffset(0);
              setDateTo(e.target.value);
            }}
            className="mt-1 block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState label="Loading bookings…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No bookings match your filters" />
      ) : (
        <>
          <AdminTable>
            <AdminTableElement>
              <AdminTableHead>
                <AdminTableHeaderCell>Event</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Client</AdminTableHeaderCell>
                <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
                <AdminTableHeaderCell>Total</AdminTableHeaderCell>
                <AdminTableHeaderCell>Payment</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right"> </AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {rows.map((r) => (
                  <AdminTableRow key={r.id}>
                    <AdminTableCell>
                      <div className="font-medium text-neutral-900">{r.event_name || "—"}</div>
                      <div className="text-xs text-neutral-500">{r.event_date}</div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge status={r.status} />
                    </AdminTableCell>
                    <AdminTableCell className="max-w-[10rem] truncate text-neutral-700">
                      {r.client_email ?? "—"}
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="font-medium text-neutral-800">{r.vendor_display_name}</div>
                      <div className="text-xs text-neutral-500">{r.vendor_email ?? ""}</div>
                    </AdminTableCell>
                    <AdminTableCell className="text-neutral-700">{r.client_total_label ?? "—"}</AdminTableCell>
                    <AdminTableCell>
                      <PaymentStatusBadge status={r.payment_status} />
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <Link
                        href={`/admin/bookings/${r.id}`}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                      >
                        View
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminTableElement>
          </AdminTable>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
            <span>
              Showing {rows.length ? offset + 1 : 0}–{offset + rows.length} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset(Math.min(maxOffset, offset + limit))}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
