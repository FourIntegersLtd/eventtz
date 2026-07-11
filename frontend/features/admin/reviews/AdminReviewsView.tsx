"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { ReviewVisibilityBadge } from "@/components/ui/ReviewVisibilityBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarRating } from "@/components/ui/StarRating";
import { fetchAdminReviews, type AdminReviewRow } from "@/lib/adminPlatformApi";
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
import { adminTrustReviewsHref, formatReviewWhen } from "./reviewFormatters";

export function AdminReviewsView() {
  const searchParams = useSearchParams();
  const vendorUserId = useMemo(() => searchParams.get("vendor")?.trim() || null, [searchParams]);
  const vendorNameFromUrl = useMemo(() => searchParams.get("vendorName")?.trim() || null, [searchParams]);

  const [rows, setRows] = useState<AdminReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { reviews, total: t } = await fetchAdminReviews(0, 100, vendorUserId);
      setRows(reviews);
      setTotal(t);
    } catch {
      setError("Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, [vendorUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolvedVendorName =
    vendorNameFromUrl ?? rows[0]?.vendor_display_name ?? null;

  if (loading) {
    return <AdminLoadingState label="Loading reviews…" />;
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}

      {vendorUserId ? (
        <AdminFilterBar>
          <p className="min-w-0 flex-1 text-sm text-neutral-700">
            Showing reviews for{" "}
            <span className="font-medium text-neutral-900">{resolvedVendorName ?? "this vendor"}</span>
            {total > 0 ? <span className="text-neutral-500">{` · ${total} total`}</span> : null}
          </p>
          <Link
            href={adminTrustReviewsHref()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filter
          </Link>
        </AdminFilterBar>
      ) : (
        <AdminPageHeader />
      )}

      {rows.length === 0 ? (
        <EmptyState title={vendorUserId ? "No reviews for this vendor" : "No reviews yet"} />
      ) : (
        <AdminTable>
          <AdminTableElement>
            <AdminTableHead>
              {!vendorUserId ? <AdminTableHeaderCell>Vendor</AdminTableHeaderCell> : null}
              <AdminTableHeaderCell>Review</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right"> </AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {rows.map((r) => {
                const vendorLabel = r.vendor_display_name ?? "Vendor";
                return (
                  <AdminTableRow key={r.id} className={r.hidden_at ? "opacity-60" : undefined}>
                    {!vendorUserId ? (
                      <AdminTableCell className="align-top">
                        <Link
                          href={adminTrustReviewsHref({
                            vendorUserId: r.vendor_user_id,
                            vendorName: vendorLabel,
                          })}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {vendorLabel}
                        </Link>
                      </AdminTableCell>
                    ) : null}
                    <AdminTableCell className="max-w-xl align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRating rating={r.rating} size="sm" />
                        {r.hidden_at ? <ReviewVisibilityBadge hidden /> : null}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-neutral-800">{r.body || "—"}</p>
                      <p className="mt-1 text-xs text-neutral-500">{formatReviewWhen(r.created_at)}</p>
                    </AdminTableCell>
                    <AdminTableCell className="text-right align-top">
                      <Link
                        href={`/admin/trust/reviews/${r.id}`}
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
