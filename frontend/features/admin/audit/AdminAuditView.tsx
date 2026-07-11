"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
  getAuditCategoryMeta,
  type AuditCategory,
} from "./auditFormatters";
import { AuditBadge, AuditEntityBadge } from "./AuditBadges";

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
        <label className="block w-full text-sm sm:w-auto">
          <span className="text-neutral-600">Show</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as AuditCategory)}
            className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm sm:w-48"
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
              <AdminTableHeaderCell>Admin</AdminTableHeaderCell>
              <AdminTableHeaderCell>Related to</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right"> </AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {filtered.map((e) => {
                const href = auditEntityHref(e);
                const entityLabel = formatAuditEntityLabel(e.entity_type);
                const summary = formatAuditSummary(e);
                const categoryMeta = getAuditCategoryMeta(e.action);
                return (
                  <AdminTableRow key={e.id}>
                    <AdminTableCell className="whitespace-nowrap text-sm text-neutral-600">
                      {formatAuditWhen(e.created_at)}
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <AuditBadge
                          label={categoryMeta.label}
                          badgeClassName={categoryMeta.badgeClassName}
                        />
                        <p className="text-sm font-medium text-neutral-900">
                          {formatAuditActionLabel(e.action)}
                        </p>
                      </div>
                      {summary ? (
                        <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500">{summary}</p>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell className="text-sm text-neutral-700">
                      {e.admin_email ?? "—"}
                    </AdminTableCell>
                    <AdminTableCell className="text-sm">
                      {href && e.entity_id ? (
                        <Link href={href} className="hover:opacity-90">
                          <AuditEntityBadge label={entityLabel} entityType={e.entity_type} />
                        </Link>
                      ) : (
                        <AuditEntityBadge label={entityLabel} entityType={e.entity_type} />
                      )}
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <Link
                        href={`/admin/audit/${e.id}`}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                      >
                        View
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
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
