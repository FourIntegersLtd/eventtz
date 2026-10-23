"use client";

import Link from "next/link";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TablePagination } from "@/components/ui/TablePagination";
import { fetchAdminAuditLog, type AdminAuditLogItem } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
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
  getAuditCategoryMeta,
  type AuditCategory,
} from "./auditFormatters";
import { AuditBadge, AuditEntityBadge } from "./AuditBadges";

const PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export function AdminAuditView() {
  const [entries, setEntries] = useState<AdminAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory>("all");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const auditCategoryOptions: EzFilterOption<AuditCategory>[] = AUDIT_CATEGORIES.map((category) => ({
    id: category.id,
    title: category.label,
  }));

  const categoryLabel =
    AUDIT_CATEGORIES.find((category) => category.id === categoryFilter)?.label ?? "Category";

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { entries: e, total: t } = await fetchAdminAuditLog(
        offset,
        PAGE_SIZE,
        categoryFilter,
      );
      setEntries(e);
      setTotal(t);
    } catch {
      setError("Could not load activity log.");
    } finally {
      setLoading(false);
    }
  }, [offset, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && entries.length === 0) {
    return <AdminLoadingState label="Loading activity log…" />;
  }

  return (
    <div className="ez-stack">
      {error ? <AdminErrorBanner message={error} /> : null}

      <EzListFilterToolbar
        onOpenFilter={() => setCategoryModalOpen(true)}
        activeFilterCount={categoryFilter !== "all" ? 1 : 0}
        summary={
          categoryFilter !== "all"
            ? {
                label: categoryLabel,
                onClear: () => {
                  setCategoryFilter("all");
                  setOffset(0);
                },
              }
            : null
        }
      />

      <EzFilterOptionsModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Filter activity"
        description="Show everything or focus on one area of the platform."
        options={auditCategoryOptions}
        value={categoryFilter}
        onChange={(id) => {
          setCategoryFilter(id);
          setOffset(0);
        }}
        listAriaLabel="Activity category"
        resetValue="all"
        resetLabel="All activity"
      />

      {entries.length === 0 ? (
        <EmptyState title="No activity in this category" lottie="searchNoResults" />
      ) : (
        <>
          <AdminTable>
            <AdminTableElement className="min-w-[44rem]">
              <AdminTableHead>
                <AdminTableHeaderCell>When</AdminTableHeaderCell>
                <AdminTableHeaderCell>Admin</AdminTableHeaderCell>
                <AdminTableHeaderCell>What happened</AdminTableHeaderCell>
                <AdminTableHeaderCell>Related to</AdminTableHeaderCell>
                <AdminTableHeaderCell>Category</AdminTableHeaderCell>
                <AdminTableHeaderCell> </AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {entries.map((e) => {
                  const href = auditEntityHref(e);
                  const entityLabel = formatAuditEntityLabel(e.entity_type);
                  const summary = formatAuditSummary(e);
                  const categoryMeta = getAuditCategoryMeta(e.action);
                  return (
                    <AdminTableRow key={e.id}>
                      <AdminTableCell className="whitespace-nowrap text-sm text-neutral-600">
                        {formatAuditWhen(e.created_at)}
                      </AdminTableCell>
                      <AdminTableCell className="text-sm text-neutral-700">
                        {e.admin_email ?? "-"}
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="text-sm font-medium text-neutral-900">
                          {formatAuditActionLabel(e.action)}
                        </p>
                        {summary ? (
                          <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500">{summary}</p>
                        ) : null}
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
                      <AdminTableCell>
                        <AuditBadge
                          label={categoryMeta.label}
                          badgeClassName={categoryMeta.badgeClassName}
                        />
                      </AdminTableCell>
                      <AdminTableCell>
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

          <TablePagination
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            pageRowCount={entries.length}
            loading={loading}
            onPrevious={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
            onNext={() => setOffset((value) => value + PAGE_SIZE)}
          />
        </>
      )}
    </div>
  );
}
