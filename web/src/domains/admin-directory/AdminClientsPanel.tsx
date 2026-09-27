"use client";

import { useEffect, useState } from "react";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminPagination,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
  formatDate,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminClients, setAdminClientSuspended, type AdminClientRow } from "@/domains/admin-directory/api";

const PAGE_SIZE = 50;

/** Directory tab: clients, searchable, with a suspend/restore toggle. */
export function AdminClientsPanel() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [clients, setClients] = useState<AdminClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loading starts `true` for the first mount; a later refetch (filter or
  // page change) swaps the rows in place without a synchronous setState in
  // the effect body — flagged by react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    fetchAdminClients({ offset, limit: PAGE_SIZE, q: search || undefined })
      .then((result) => {
        if (cancelled) return;
        setClients(result.clients);
        setTotal(result.total);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(isPlatformError(cause) ? cause.detail : "Could not load clients.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset, search]);

  async function handleToggleSuspended(client: AdminClientRow) {
    try {
      await setAdminClientSuspended(client.user_id, !client.account_suspended);
      setClients((current) =>
        current.map((row) =>
          row.user_id === client.user_id ? { ...row, account_suspended: !row.account_suspended } : row,
        ),
      );
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not update this client.");
    }
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="Search email"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setOffset(0);
        }}
        className="rounded-xl border border-primary-border px-3 py-2 text-sm"
      />

      {loading ? <AdminLoadingState label="Loading clients…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && clients.length === 0 ? <AdminEmptyState title="No clients match your search" /> : null}
      {!loading && !error && clients.length > 0 ? (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTableHeaderCell>Email</AdminTableHeaderCell>
                <AdminTableHeaderCell>Bookings</AdminTableHeaderCell>
                <AdminTableHeaderCell>Joined</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {clients.map((client) => (
                <AdminTableRow key={client.user_id} tinted={client.account_suspended ? "warning" : undefined}>
                  <AdminTableCell>{client.email ?? client.user_id}</AdminTableCell>
                  <AdminTableCell>{client.booking_count}</AdminTableCell>
                  <AdminTableCell>{formatDate(client.created_at)}</AdminTableCell>
                  <AdminTableCell>
                    <button
                      type="button"
                      onClick={() => void handleToggleSuspended(client)}
                      className={
                        client.account_suspended
                          ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                          : "rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                      }
                    >
                      {client.account_suspended ? "Suspended — restore" : "Active — suspend"}
                    </button>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            onNext={() => setOffset(offset + PAGE_SIZE)}
          />
        </>
      ) : null}
    </div>
  );
}
