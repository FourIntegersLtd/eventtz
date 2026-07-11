"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarRating } from "@/components/ui/StarRating";
import { fetchAdminReviews, patchReviewVisibility, type AdminReviewRow } from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
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

export function AdminReviewsView() {
  const [rows, setRows] = useState<AdminReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminReviewRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { reviews, total: t } = await fetchAdminReviews(0, 100);
      setRows(reviews);
      setTotal(t);
    } catch {
      setError("Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleVisibility = async (row: AdminReviewRow) => {
    const hidden = !row.hidden_at;
    setBusyId(row.id);
    try {
      await patchReviewVisibility(row.id, hidden);
      setConfirmTarget(null);
      await load();
    } catch {
      setError("Could not update review.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading reviews…" />;
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <AdminPageHeader />

      {rows.length === 0 ? (
        <EmptyState title="No reviews yet" />
      ) : (
        <AdminTable>
          <AdminTableElement>
            <AdminTableHead>
              <AdminTableHeaderCell>Rating</AdminTableHeaderCell>
              <AdminTableHeaderCell>Body</AdminTableHeaderCell>
              <AdminTableHeaderCell>Booking</AdminTableHeaderCell>
              <AdminTableHeaderCell>Visibility</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right">Action</AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {rows.map((r) => (
                <AdminTableRow key={r.id} className={r.hidden_at ? "opacity-60" : undefined}>
                  <AdminTableCell>
                    <StarRating rating={r.rating} size="sm" />
                  </AdminTableCell>
                  <AdminTableCell className="max-w-md text-neutral-800">{r.body}</AdminTableCell>
                  <AdminTableCell>
                    <Link
                      href={`/admin/bookings/${r.booking_request_id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open booking
                    </Link>
                  </AdminTableCell>
                  <AdminTableCell>
                    {r.hidden_at ? (
                      <span className="inline-flex rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                        Hidden
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                        Visible
                      </span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setConfirmTarget(r)}
                      className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-medium hover:bg-neutral-50"
                    >
                      {r.hidden_at ? "Show" : "Hide"}
                    </button>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmTarget)}
        title={confirmTarget?.hidden_at ? "Show review publicly?" : "Hide review from profile?"}
        confirmLabel={confirmTarget?.hidden_at ? "Show" : "Hide"}
        confirmVariant={confirmTarget?.hidden_at ? "primary" : "destructive"}
        loading={busyId === confirmTarget?.id}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) void toggleVisibility(confirmTarget);
        }}
      />
    </div>
  );
}
