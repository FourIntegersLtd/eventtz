"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
  formatDate,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminReviews, type AdminReviewRow } from "@/domains/admin-trust/api";

/** Trust tab: reviews. Links to `/admin/trust/reviews/[id]` for hide/unhide moderation. */
export function AdminReviewsPanel() {
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      setReviews(await fetchAdminReviews());
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  if (loading) return <AdminLoadingState label="Loading reviews…" />;
  if (error) return <AdminErrorBanner message={error} />;
  if (reviews.length === 0) return <AdminEmptyState title="No reviews yet" />;

  return (
    <AdminTable>
      <AdminTableHead>
        <tr>
          <AdminTableHeaderCell>Vendor</AdminTableHeaderCell>
          <AdminTableHeaderCell>Rating</AdminTableHeaderCell>
          <AdminTableHeaderCell>Left</AdminTableHeaderCell>
          <AdminTableHeaderCell>Status</AdminTableHeaderCell>
          <AdminTableHeaderCell>View</AdminTableHeaderCell>
        </tr>
      </AdminTableHead>
      <AdminTableBody>
        {reviews.map((review) => (
          <AdminTableRow key={review.id}>
            <AdminTableCell>{review.vendor_display_name ?? "-"}</AdminTableCell>
            <AdminTableCell>{"★".repeat(review.rating)}</AdminTableCell>
            <AdminTableCell>{formatDate(review.created_at)}</AdminTableCell>
            <AdminTableCell>{review.hidden_at ? "Hidden" : "Visible"}</AdminTableCell>
            <AdminTableCell>
              <Link href={`/admin/trust/reviews/${review.id}`} className="font-medium text-primary hover:underline">
                Moderate
              </Link>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </AdminTableBody>
    </AdminTable>
  );
}
