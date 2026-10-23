"use client";

import { ButtonLink } from "@/components/ui/ButtonLink";
import { useMemo, useState } from "react";
import { useServerList } from "@/lib/useServerList";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReviewVisibilityBadge } from "@/components/badges/ReviewVisibilityBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarRating } from "@/components/ui/StarRating";
import { fetchAdminReviews } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { adminTrustReviewsHref, formatReviewWhen } from "./reviewFormatters";

type ReviewFilter = "all" | "published" | "hidden";

const REVIEW_FILTER_OPTIONS: EzFilterOption<ReviewFilter>[] = [
  { id: "all", title: "All reviews" },
  { id: "published", title: "Published", subtitle: "Visible on vendor profiles" },
  { id: "hidden", title: "Hidden", subtitle: "Removed from public profiles" },
];

function reviewFilterLabel(filter: ReviewFilter): string {
  return REVIEW_FILTER_OPTIONS.find((option) => option.id === filter)?.title ?? "Filter";
}

export function AdminReviewsView() {
  const searchParams = useSearchParams();
  const vendorUserId = useMemo(() => searchParams.get("vendor")?.trim() || null, [searchParams]);
  const vendorNameFromUrl = useMemo(() => searchParams.get("vendorName")?.trim() || null, [searchParams]);

  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const {
    items: rows,
    total,
    offset,
    limit,
    loading,
    error,
    goNext,
    goPrevious,
  } = useServerList({
    filters: { vendorUserId, filter },
    errorMessage: "Could not load reviews.",
    fetchPage: async ({ offset: pageOffset, limit: pageLimit, filters }) => {
      const page = await fetchAdminReviews(pageOffset, pageLimit, filters.vendorUserId, filters.filter);
      return { items: page.reviews, total: page.total };
    },
  });

  const resolvedVendorName =
    vendorNameFromUrl ?? rows[0]?.vendor_display_name ?? null;

  if (loading) {
    return <AdminLoadingState label="Loading reviews…" />;
  }

  return (
    <div className="ez-stack ez-stack--lg">
      {error ? <AdminErrorBanner message={error} /> : null}

      {vendorUserId ? (
        <div className="ez-hrow flex-wrap !items-end gap-3">
          <p className="min-w-0 flex-1 ez-small">
            Showing reviews for{" "}
            <span className="ez-strong">{resolvedVendorName ?? "this vendor"}</span>
            {total > 0 ? <span>{` · ${total} total`}</span> : null}
          </p>
          <ButtonLink href={adminTrustReviewsHref()} variant="secondary" size="sm">
            Clear filter
          </ButtonLink>
        </div>
      ) : null}

      <EzListFilterToolbar
        onOpenFilter={() => setFilterOpen(true)}
        activeFilterCount={filter !== "all" ? 1 : 0}
        summary={
          filter !== "all"
            ? {
                label: reviewFilterLabel(filter),
                onClear: () => setFilter("all"),
              }
            : null
        }
      />

      <EzFilterOptionsModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter reviews"
        description="Show all reviews or narrow by visibility on vendor profiles."
        options={REVIEW_FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
        listAriaLabel="Review visibility"
        resetValue="all"
        resetLabel="Show all"
      />

      {rows.length === 0 ? (
        <EmptyState
          title={vendorUserId ? "No reviews for this vendor" : "No reviews yet"}
          lottie="searchNoResults"
        />
      ) : (
        <DataTable
          aria-label="Reviews"
          tableClassName="min-w-[40rem]"
          rows={rows}
          getRowKey={(row) => row.id}
          rowClassName={(row) => (row.hidden_at ? "opacity-70" : undefined)}
          columns={[
            {
              key: "vendor",
              header: "Vendor",
              kind: "strong",
              className: "align-top",
              cell: (row) => {
                const vendorLabel = row.vendor_display_name ?? "Vendor";
                return (
                  <Link
                    href={adminTrustReviewsHref({ vendorUserId: row.vendor_user_id, vendorName: vendorLabel })}
                    className="hover:underline"
                  >
                    {vendorLabel}
                  </Link>
                );
              },
            },
            {
              key: "rating",
              header: "Rating",
              className: "align-top",
              cell: (row) => <StarRating rating={row.rating} size="sm" />,
            },
            {
              key: "review",
              header: "Review",
              className: "max-w-md align-top",
              cell: (row) => <p className="line-clamp-2 text-sm">{row.body || "-"}</p>,
            },
            { key: "client", header: "Client", className: "align-top text-sm", cell: (row) => row.client_email ?? "-" },
            {
              key: "status",
              header: "Status",
              kind: "status",
              className: "align-top whitespace-nowrap",
              cell: (row) => (row.hidden_at ? <ReviewVisibilityBadge hidden /> : <Badge tone="success">Published</Badge>),
            },
            {
              key: "date",
              header: "Date",
              className: "align-top ez-caption whitespace-nowrap",
              cell: (row) => formatReviewWhen(row.created_at),
            },
            {
              key: "open",
              header: " ",
              className: "align-top",
              cell: (row) => (
                <ButtonLink href={`/admin/trust/reviews/${row.id}`} variant="secondary" size="sm">
                  Open
                </ButtonLink>
              ),
            },
          ]}
        />
      )}

      <TablePagination
        offset={offset}
        limit={limit}
        total={total}
        pageRowCount={rows.length}
        loading={loading}
        onPrevious={goPrevious}
        onNext={goNext}
      />
    </div>
  );
}
