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
import { DataTable } from "@/components/ui/DataTable";
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
          <DataTable
            aria-label="Admin activity"
            tableClassName="min-w-[44rem]"
            rows={entries}
            getRowKey={(entry) => entry.id}
            columns={[
              {
                key: "when",
                header: "When",
                className: "whitespace-nowrap text-sm text-neutral-600",
                cell: (entry) => formatAuditWhen(entry.created_at),
              },
              {
                key: "admin",
                header: "Admin",
                className: "text-sm text-neutral-700",
                cell: (entry) => entry.admin_email ?? "-",
              },
              {
                key: "what",
                header: "What happened",
                cell: (entry) => {
                  const summary = formatAuditSummary(entry);
                  return (
                    <>
                      <p className="text-sm font-medium text-neutral-900">{formatAuditActionLabel(entry.action)}</p>
                      {summary ? <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500">{summary}</p> : null}
                    </>
                  );
                },
              },
              {
                key: "related",
                header: "Related to",
                className: "text-sm",
                cell: (entry) => {
                  const href = auditEntityHref(entry);
                  const badge = (
                    <AuditEntityBadge label={formatAuditEntityLabel(entry.entity_type)} entityType={entry.entity_type} />
                  );
                  return href && entry.entity_id ? (
                    <Link href={href} className="hover:opacity-90">
                      {badge}
                    </Link>
                  ) : (
                    badge
                  );
                },
              },
              {
                key: "category",
                header: "Category",
                cell: (entry) => {
                  const categoryMeta = getAuditCategoryMeta(entry.action);
                  return <AuditBadge label={categoryMeta.label} badgeClassName={categoryMeta.badgeClassName} />;
                },
              },
              {
                key: "view",
                header: " ",
                cell: (entry) => (
                  <Link
                    href={`/admin/audit/${entry.id}`}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                  >
                    View
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ),
              },
            ]}
          />

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
