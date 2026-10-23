"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useServerList } from "@/lib/useServerList";
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

/** Activity log filtered by category; the api pages it (default 25 per page). */
export function AdminAuditView() {
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory>("all");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const {
    items: entries,
    total,
    offset,
    limit,
    loading,
    error,
    goNext,
    goPrevious,
  } = useServerList<AdminAuditLogItem, { category: AuditCategory }>({
    filters: { category: categoryFilter },
    errorMessage: "Could not load activity log.",
    fetchPage: async ({ offset: pageOffset, limit: pageLimit, filters }) => {
      const page = await fetchAdminAuditLog(pageOffset, pageLimit, filters.category);
      return { items: page.entries, total: page.total };
    },
  });

  const auditCategoryOptions: EzFilterOption<AuditCategory>[] = AUDIT_CATEGORIES.map((category) => ({
    id: category.id,
    title: category.label,
  }));

  const categoryLabel =
    AUDIT_CATEGORIES.find((category) => category.id === categoryFilter)?.label ?? "Category";

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
                onClear: () => setCategoryFilter("all"),
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
        onChange={setCategoryFilter}
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
                className: "whitespace-nowrap text-sm text-ink-2",
                cell: (entry) => formatAuditWhen(entry.created_at),
              },
              {
                key: "admin",
                header: "Admin",
                className: "text-sm text-ink-2",
                cell: (entry) => entry.admin_email ?? "-",
              },
              {
                key: "what",
                header: "What happened",
                cell: (entry) => {
                  const summary = formatAuditSummary(entry);
                  return (
                    <>
                      <p className="text-sm font-medium text-ink">{formatAuditActionLabel(entry.action)}</p>
                      {summary ? <p className="mt-1.5 line-clamp-2 text-xs text-ink-3">{summary}</p> : null}
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
            limit={limit}
            total={total}
            pageRowCount={entries.length}
            loading={loading}
            onPrevious={goPrevious}
            onNext={goNext}
          />
        </>
      )}
    </div>
  );
}
