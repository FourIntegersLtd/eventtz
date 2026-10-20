"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_DISPUTES_PAGE_SIZE,
  fetchAdminDisputesPage,
  type AdminDisputeCase,
} from "@/lib/adminPlatformApi";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
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
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await fetchAdminDisputesPage(
        statusFilter,
        offset,
        ADMIN_DISPUTES_PAGE_SIZE,
        search,
      );
      setRows(page.disputes);
      setTotal(page.total);
    } catch {
      setError("Could not load disputes.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!managing) return;
    const fresh = rows.find((r) => r.id === managing.id);
    if (fresh) setManaging(fresh);
  }, [rows, managing?.id]);

  if (loading && rows.length === 0) {
    return <AdminLoadingState label="Loading disputes…" />;
  }

  return (
    <div className="ez-stack">
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

      <DisputesTable
        rows={rows}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setOffset(0);
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setOffset(0);
        }}
        onManage={setManaging}
      />

      <TablePagination
        offset={offset}
        limit={ADMIN_DISPUTES_PAGE_SIZE}
        total={total}
        loading={loading}
        onPrevious={() => setOffset((current) => Math.max(0, current - ADMIN_DISPUTES_PAGE_SIZE))}
        onNext={() => setOffset((current) => current + ADMIN_DISPUTES_PAGE_SIZE)}
      />
    </div>
  );
}
