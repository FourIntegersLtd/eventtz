"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchAdminAuditLog, type AdminAuditLogItem } from "@/lib/adminPlatformApi";
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
import {
  AUDIT_CATEGORIES,
  auditEntityHref,
  formatAuditActionLabel,
  formatAuditEntityLabel,
  formatAuditSummary,
  formatAuditWhen,
  getAuditCategory,
  hasTechnicalPayload,
  type AuditCategory,
} from "./auditFormatters";

export function AdminAuditView() {
  const [entries, setEntries] = useState<AdminAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const { entries: e, total: t } = await fetchAdminAuditLog(0, 200);
      setEntries(e);
      setTotal(t);
    } catch {
      setError("Could not load activity log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return entries;
    return entries.filter((e) => getAuditCategory(e.action) === categoryFilter);
  }, [entries, categoryFilter]);

  if (loading) {
    return <AdminLoadingState label="Loading activity log…" />;
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <AdminPageHeader />

      <AdminFilterBar>
        <label className="text-sm">
          <span className="text-neutral-600">Show</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as AuditCategory)}
            className="mt-1 block rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </AdminFilterBar>

      {filtered.length === 0 ? (
        <EmptyState title="No activity in this category" />
      ) : (
        <AdminTable>
          <AdminTableElement>
            <AdminTableHead>
              <AdminTableHeaderCell>When</AdminTableHeaderCell>
              <AdminTableHeaderCell>What happened</AdminTableHeaderCell>
              <AdminTableHeaderCell>Details</AdminTableHeaderCell>
              <AdminTableHeaderCell>Related to</AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {filtered.map((e) => {
                const href = auditEntityHref(e);
                const entityLabel = formatAuditEntityLabel(e.entity_type);
                return (
                  <AdminTableRow key={e.id}>
                    <AdminTableCell className="whitespace-nowrap text-sm text-neutral-600">
                      {formatAuditWhen(e.created_at)}
                    </AdminTableCell>
                    <AdminTableCell>
                      <p className="text-sm font-medium text-neutral-900">
                        {formatAuditActionLabel(e.action)}
                      </p>
                    </AdminTableCell>
                    <AdminTableCell className="max-w-md text-sm text-neutral-700">
                      <p>{formatAuditSummary(e)}</p>
                      {hasTechnicalPayload(e) ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-700">
                            Technical record
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto rounded-lg border border-neutral-100 bg-neutral-50 p-2 font-mono text-[10px] text-neutral-600">
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell className="text-sm">
                      {href && e.entity_id ? (
                        <Link href={href} className="font-medium text-primary hover:underline">
                          {entityLabel}
                        </Link>
                      ) : (
                        <span className="text-neutral-700">{entityLabel}</span>
                      )}
                      {e.entity_id && !href ? (
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          Ref {e.entity_id.slice(0, 8)}…
                        </span>
                      ) : null}
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}

    </div>
  );
}
