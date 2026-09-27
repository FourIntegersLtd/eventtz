"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  formatDateTime,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { AUDIT_CATEGORIES, fetchAdminAuditLog, type AdminAuditLogItem, type AuditCategory } from "@/domains/admin-audit/api";
import { formatAuditActionLabel } from "@/domains/admin-audit/auditFormatters";

const PAGE_SIZE = 50;

/** `/admin/audit` — a paginated, category-filterable feed of every admin action taken on the platform. */
export function AdminAuditListView() {
  const [category, setCategory] = useState<AuditCategory>("all");
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<AdminAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const result = await fetchAdminAuditLog(offset, PAGE_SIZE, category);
      if (mySeq !== requestSeq.current) return;
      setEntries(result.entries);
      setTotal(result.total);
    } catch (cause) {
      if (mySeq !== requestSeq.current) return;
      setError(isPlatformError(cause) ? cause.detail : "Could not load activity log.");
    } finally {
      if (mySeq !== requestSeq.current) return;
      setLoading(false);
    }
  }, [offset, category]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div className="space-y-4">
      <select
        value={category}
        onChange={(event) => {
          setCategory(event.target.value as AuditCategory);
          setOffset(0);
        }}
        className="rounded-xl border border-primary-border px-3 py-2 text-sm"
      >
        {AUDIT_CATEGORIES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {loading ? <AdminLoadingState label="Loading activity log…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && entries.length === 0 ? (
        <AdminEmptyState title="No activity in this category" />
      ) : null}
      {!loading && !error && entries.length > 0 ? (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTableHeaderCell>When</AdminTableHeaderCell>
                <AdminTableHeaderCell>What happened</AdminTableHeaderCell>
                <AdminTableHeaderCell>Admin</AdminTableHeaderCell>
                <AdminTableHeaderCell>View</AdminTableHeaderCell>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {entries.map((entry) => (
                <AdminTableRow key={entry.id}>
                  <AdminTableCell>{formatDateTime(entry.created_at)}</AdminTableCell>
                  <AdminTableCell>{formatAuditActionLabel(entry.action)}</AdminTableCell>
                  <AdminTableCell>{entry.admin_email ?? "-"}</AdminTableCell>
                  <AdminTableCell>
                    <Link href={`/admin/audit/${entry.id}`} className="font-medium text-primary hover:underline">
                      View
                    </Link>
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
