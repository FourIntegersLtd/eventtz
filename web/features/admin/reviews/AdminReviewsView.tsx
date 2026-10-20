"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReviewVisibilityBadge } from "@/components/badges/ReviewVisibilityBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarRating } from "@/components/ui/StarRating";
import { fetchAdminReviews, type AdminReviewRow } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { TablePagination } from "@/components/ui/TablePagination";
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

const REVIEWS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export function AdminReviewsView() {
  const searchParams = useSearchParams();
  const vendorUserId = useMemo(() => searchParams.get("vendor")?.trim() || null, [searchParams]);
  const vendorNameFromUrl = useMemo(() => searchParams.get("vendorName")?.trim() || null, [searchParams]);

  const [rows, setRows] = useState<AdminReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { reviews, total: reviewTotal } = await fetchAdminReviews(
        offset,
        REVIEWS_PAGE_SIZE,
        vendorUserId,
        filter,
      );
      setRows(reviews);
      setTotal(reviewTotal);
    } catch {
      setError("Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, [offset, vendorUserId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [vendorUserId, filter]);

  const resolvedVendorName =
    vendorNameFromUrl ?? rows[0]?.vendor_display_name ?? null;

  if (loading) {
    return <AdminLoadingState label="Loading reviews…" />;
  }

  return (
    <div className="ez-stack ez-stack--lg">
      {error ? <AdminErrorBanner message={error} /> : null}

      {vendorUserId ? (
        <AdminFilterBar>
          <p className="min-w-0 flex-1 ez-small">
            Showing reviews for{" "}
            <span className="ez-strong">{resolvedVendorName ?? "this vendor"}</span>
            {total > 0 ? <span>{` · ${total} total`}</span> : null}
          </p>
          <Link href={adminTrustReviewsHref()} className="ez-btn ez-btn--secondary ez-btn--sm">
            Clear filter
          </Link>
        </AdminFilterBar>
      ) : null}

      <EzListFilterToolbar
        onOpenFilter={() => setFilterOpen(true)}
        activeFilterCount={filter !== "all" ? 1 : 0}
        summary={
          filter !== "all"
            ? {
                label: reviewFilterLabel(filter),
                onClear: () => {
                  setFilter("all");
                  setOffset(0);
                },
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
        onChange={(id) => {
          setFilter(id);
          setOffset(0);
        }}
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
        <AdminTable>
          <AdminTableElement className="min-w-[40rem]">
            <AdminTableHead>
              <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
              <AdminTableHeaderCell>Rating</AdminTableHeaderCell>
              <AdminTableHeaderCell>Review</AdminTableHeaderCell>
              <AdminTableHeaderCell>Client</AdminTableHeaderCell>
              <AdminTableHeaderCell className="ez-td-status">Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Date</AdminTableHeaderCell>
              <AdminTableHeaderCell> </AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {rows.map((row) => {
                const vendorLabel = row.vendor_display_name ?? "Vendor";
                return (
                  <AdminTableRow key={row.id} className={row.hidden_at ? "opacity-70" : undefined}>
                    <AdminTableCell className="ez-td-strong align-top">
                      <Link
                        href={adminTrustReviewsHref({
                          vendorUserId: row.vendor_user_id,
                          vendorName: vendorLabel,
                        })}
                        className="hover:underline"
                      >
                        {vendorLabel}
                      </Link>
                    </AdminTableCell>
                    <AdminTableCell className="align-top">
                      <StarRating rating={row.rating} size="sm" />
                    </AdminTableCell>
                    <AdminTableCell className="max-w-md align-top">
                      <p className="line-clamp-2 text-sm">{row.body || "-"}</p>
                    </AdminTableCell>
                    <AdminTableCell className="align-top text-sm">
                      {row.client_email ?? "-"}
                    </AdminTableCell>
                    <AdminTableCell className="ez-td-status align-top whitespace-nowrap">
                      {row.hidden_at ? (
                        <ReviewVisibilityBadge hidden />
                      ) : (
                        <span className="ez-badge ez-badge--success">Published</span>
                      )}
                    </AdminTableCell>
                    <AdminTableCell className="align-top ez-caption whitespace-nowrap">
                      {formatReviewWhen(row.created_at)}
                    </AdminTableCell>
                    <AdminTableCell className="align-top">
                      <Link
                        href={`/admin/trust/reviews/${row.id}`}
                        className="ez-btn ez-btn--secondary ez-btn--sm"
                      >
                        Open
                      </Link>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}

      <TablePagination
        offset={offset}
        limit={REVIEWS_PAGE_SIZE}
        total={total}
        pageRowCount={rows.length}
        loading={loading}
        onPrevious={() => setOffset((value) => Math.max(0, value - REVIEWS_PAGE_SIZE))}
        onNext={() => setOffset((value) => value + REVIEWS_PAGE_SIZE)}
      />
    </div>
  );
}
