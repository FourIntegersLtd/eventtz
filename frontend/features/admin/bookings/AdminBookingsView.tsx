"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminFilterDateField } from "@/features/admin/components/AdminFilterDateField";
import { AdminFilterDateRange } from "@/features/admin/components/AdminFilterDateRange";
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
import type { AdminBookingListItem } from "@/lib/adminPlatformApi";

const STATUSES = ["", "pending", "accepted", "completed", "declined", "cancelled"];

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
  } = useAdminBookings({ status: initialStatus, needs_attention: initialNeedsAttention });

  const maxOffset = Math.max(0, total - limit);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}

      <AdminPageHeader />

      <AdminFilterBar>
        <label className="block w-full min-w-0 max-w-full text-sm lg:w-auto">
          <span className="text-neutral-600">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setOffset(0);
              setStatus(e.target.value);
            }}
            className="mt-1 box-border block h-11 w-full max-w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm lg:w-44"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s : "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full min-w-0 max-w-full text-sm lg:min-w-[12rem] lg:flex-1">
          <span className="text-neutral-600">Search event name</span>
          <input
            value={search}
            onChange={(e) => {
              setOffset(0);
              setSearch(e.target.value);
            }}
            className="mt-1 box-border block h-11 w-full max-w-full min-w-0 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Contains…"
          />
        </label>
        <AdminFilterDateRange>
          <AdminFilterDateField
            label="From"
            value={dateFrom}
            onChange={(value) => {
              setOffset(0);
              setDateFrom(value);
            }}
          />
          <AdminFilterDateField
            label="To"
            value={dateTo}
            onChange={(value) => {
              setOffset(0);
              setDateTo(value);
            }}
          />
        </AdminFilterDateRange>
        <label className="flex h-11 items-center gap-2 self-end text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={needsAttentionOnly}
            onChange={(e) => {
              setOffset(0);
              setNeedsAttentionOnly(e.target.checked);
            }}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Needs support only
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
                <AdminTableHeaderCell>Support</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right"> </AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {rows.map((r) => (
                  <AdminTableRow key={r.id} className={supportRowClass(r.support)}>
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
                    <AdminTableCell className="max-w-[14rem]">
                      {r.support?.needs_attention_count ? (
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              r.support.max_severity === "critical"
                                ? "text-red-800"
                                : "text-amber-900"
                            }`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {r.support.next_action ?? "Review"}
                          </span>
                          {r.support.primary_label ? (
                            <p className="line-clamp-2 text-[11px] leading-snug text-neutral-600">
                              {r.support.primary_label}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
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
