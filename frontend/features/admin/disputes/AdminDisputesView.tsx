"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminDisputes, type AdminDisputeCase } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { DisputeActionPanel } from "./DisputeActionPanel";
import { DisputeResolveModal } from "./DisputeResolveModal";
import { DisputesTable } from "./DisputesTable";

export function AdminDisputesView() {
  const [rows, setRows] = useState<AdminDisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState<AdminDisputeCase | null>(null);
  const [resolving, setResolving] = useState<AdminDisputeCase | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchAdminDisputes();
      setRows(list);
    } catch {
      setError("Could not load disputes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!managing) return;
    const fresh = rows.find((r) => r.id === managing.id);
    if (fresh) setManaging(fresh);
  }, [rows, managing?.id]);

  if (loading) {
    return <AdminLoadingState label="Loading disputes…" />;
  }

  return (
    <div className="space-y-4">
      {managing ? (
        <DisputeActionPanel
          dispute={managing}
          onClose={() => {
            setManaging(null);
            setResolving(null);
          }}
          onUpdated={load}
          onResolve={(d) => setResolving(d)}
        />
      ) : null}
      {resolving ? (
        <DisputeResolveModal
          dispute={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null);
            void load();
          }}
        />
      ) : null}
      {error ? <AdminErrorBanner message={error} /> : null}

      <AdminPageHeader />

      <DisputesTable
        rows={rows}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onManage={setManaging}
      />
    </div>
  );
}
