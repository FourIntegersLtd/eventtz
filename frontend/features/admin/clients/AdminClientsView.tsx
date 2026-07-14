"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ADMIN_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { AccountStatusBadge } from "@/components/ui/AccountStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { patchClientSuspended, type AdminClientRow } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { useAdminClients } from "@/features/admin/clients/useAdminClients";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import { useState } from "react";

export function AdminClientsView() {
  const { canSuspendClients } = useAdminPermissions();
  const {
    rows,
    total,
    offset,
    limit,
    setOffset,
    loading,
    error,
    search,
    setSearch,
    suspendedFilter,
    setSuspendedFilter,
    reload,
  } = useAdminClients();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminClientRow | null>(null);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const toggleSuspended = async (row: AdminClientRow) => {
    setBusyId(row.user_id);
    try {
      await patchClientSuspended(row.user_id, !row.account_suspended);
      setConfirmTarget(null);
      await reload();
    } catch {
      // error surfaced via hook on next load
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <AdminPageHeader />

      <AdminFilterBar>
        <label className="block w-full min-w-0 max-w-full text-sm lg:min-w-[12rem] lg:flex-1">
          <span className="text-neutral-600">Search email</span>
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
        <label className="block w-full min-w-0 max-w-full text-sm lg:w-auto">
          <span className="text-neutral-600">Status</span>
          <select
            value={suspendedFilter}
            onChange={(e) => {
              setOffset(0);
              setSuspendedFilter(e.target.value as "" | "true" | "false");
            }}
            className="mt-1 box-border block h-11 w-full max-w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm lg:w-44"
          >
            <option value="">All</option>
            <option value="false">Active</option>
            <option value="true">Suspended</option>
          </select>
        </label>
      </AdminFilterBar>

      {loading ? (
        <AdminLoadingState label="Loading clients…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No clients match your filters" />
      ) : (
        <>
          <AdminTable>
            <AdminTableElement className="min-w-[36rem]">
              <AdminTableHead>
                <AdminTableHeaderCell className="min-w-[11rem]">Email</AdminTableHeaderCell>
                <AdminTableHeaderCell>Bookings</AdminTableHeaderCell>
                <AdminTableHeaderCell>Created</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">Action</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {rows.map((r) => (
                  <AdminTableRow
                    key={r.user_id}
                    className={r.account_suspended ? "opacity-70" : undefined}
                  >
                    <AdminTableCell className="min-w-[11rem] max-w-[14rem]">
                      <span className="block truncate" title={r.email ?? undefined}>
                        {r.email ?? "—"}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell className="tabular-nums">{r.booking_count}</AdminTableCell>
                    <AdminTableCell className="text-neutral-600">
                      {r.created_at ? String(r.created_at).slice(0, 10) : "—"}
                    </AdminTableCell>
                    <AdminTableCell>
                      <AccountStatusBadge suspended={r.account_suspended} />
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      {canSuspendClients ? (
                        <button
                          type="button"
                          disabled={busyId === r.user_id}
                          onClick={() => setConfirmTarget(r)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                            r.account_suspended
                              ? "border border-green-200 bg-green-50 text-green-900 hover:bg-green-100"
                              : "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          }`}
                        >
                          {r.account_suspended ? "Unsuspend" : "Suspend"}
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
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
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset(offset + limit)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        title={
          confirmTarget?.account_suspended
            ? ADMIN_CONFIRM_COPY.unsuspendClient.title
            : ADMIN_CONFIRM_COPY.suspendClient.title
        }
        description={
          confirmTarget?.account_suspended
            ? ADMIN_CONFIRM_COPY.unsuspendClient.description
            : ADMIN_CONFIRM_COPY.suspendClient.description
        }
        confirmLabel={
          confirmTarget?.account_suspended
            ? ADMIN_CONFIRM_COPY.unsuspendClient.confirmLabel
            : ADMIN_CONFIRM_COPY.suspendClient.confirmLabel
        }
        confirmVariant={confirmTarget?.account_suspended ? "primary" : "destructive"}
        loading={busyId === confirmTarget?.user_id}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) void toggleSuspended(confirmTarget);
        }}
      />
    </div>
  );
}
