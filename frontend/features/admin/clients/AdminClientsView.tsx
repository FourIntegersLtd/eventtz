"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AccountStatusBadge } from "@/components/ui/AccountStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchAdminClients, patchClientSuspended, type AdminClientRow } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
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

export function AdminClientsView() {
  const [rows, setRows] = useState<AdminClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminClientRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchAdminClients();
      setRows(list);
    } catch {
      setError("Could not load clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSuspended = async (row: AdminClientRow) => {
    setBusyId(row.user_id);
    try {
      await patchClientSuspended(row.user_id, !row.account_suspended);
      setConfirmTarget(null);
      await load();
    } catch {
      setError("Could not update suspension.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading clients…" />;
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <AdminPageHeader />

      {rows.length === 0 ? (
        <EmptyState title="No clients yet" />
      ) : (
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
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        title={confirmTarget?.account_suspended ? "Unsuspend client?" : "Suspend client?"}
        confirmLabel={confirmTarget?.account_suspended ? "Unsuspend" : "Suspend"}
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
