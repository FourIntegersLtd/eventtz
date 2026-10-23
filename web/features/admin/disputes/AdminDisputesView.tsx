"use client";

import { useEffect, useState } from "react";
import { fetchAdminDisputesPage, type AdminDisputeCase } from "@/lib/adminPlatformApi";
import { useServerList } from "@/lib/useServerList";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { DisputeActionPanel } from "./DisputeActionPanel";
import { DisputeResolveModal } from "./DisputeResolveModal";
import { DisputesTable } from "./DisputesTable";

export function AdminDisputesView() {
  const [managing, setManaging] = useState<AdminDisputeCase | null>(null);
  const [resolving, setResolving] = useState<AdminDisputeCase | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");

  const {
    items: rows,
    total,
    offset,
    limit,
    loading,
    error,
    goNext,
    goPrevious,
    reload: load,
  } = useServerList({
    filters: { statusFilter },
    search,
    errorMessage: "Could not load disputes.",
    fetchPage: async ({ offset: pageOffset, limit: pageLimit, filters, search: searchText }) => {
      const page = await fetchAdminDisputesPage(filters.statusFilter, pageOffset, pageLimit, searchText);
      return { items: page.disputes, total: page.total };
    },
  });

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
        onStatusFilterChange={setStatusFilter}
        search={search}
        onSearchChange={setSearch}
        onManage={setManaging}
      />

      <TablePagination
        offset={offset}
        limit={limit}
        total={total}
        loading={loading}
        onPrevious={goPrevious}
        onNext={goNext}
      />
    </div>
  );
}
