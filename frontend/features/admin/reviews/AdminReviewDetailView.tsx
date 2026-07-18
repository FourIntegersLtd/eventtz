"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ADMIN_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { ReviewVisibilityBadge } from "@/components/ui/ReviewVisibilityBadge";
import { StarRating } from "@/components/ui/StarRating";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import {
  fetchAdminReview,
  patchReviewVisibility,
  type AdminReviewRow,
} from "@/lib/adminPlatformApi";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import {
  adminTrustReviewsHref,
  formatReviewEventDate,
  formatReviewWhen,
} from "./reviewFormatters";

type Props = {
  reviewId: string;
};

export function AdminReviewDetailView({ reviewId }: Props) {
  const { canModerateReviews } = useAdminPermissions();
  const [review, setReview] = useState<AdminReviewRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setReview(await fetchAdminReview(reviewId));
    } catch {
      setError("Could not load review.");
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleVisibility = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await patchReviewVisibility(review.id, !review.hidden_at);
      setConfirmHide(false);
      await load();
    } catch {
      setError("Could not update review visibility.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading review…" rows={2} />;
  }

  if (error || !review) {
    return <AdminErrorBanner message={error ?? "Not found."} />;
  }

  const vendorName = review.vendor_display_name ?? "Vendor";
  const backHref = adminTrustReviewsHref({
    vendorUserId: review.vendor_user_id,
    vendorName,
  });

  return (
    <div className="space-y-6">
      <BackLink href={backHref} label="Reviews" icon="chevron" tone="muted" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StarRating rating={review.rating} size="md" />
            <ReviewVisibilityBadge hidden={Boolean(review.hidden_at)} />
          </div>
          <h1 className="mt-2 font-heading text-2xl font-semibold text-neutral-900">{vendorName}</h1>
          <p className="mt-1 text-sm text-neutral-600">{formatReviewWhen(review.created_at)}</p>
        </div>
        {canModerateReviews ? (
          <Button
            variant={review.hidden_at ? "primary" : "destructive"}
            size="sm"
            loading={busy}
            onClick={() => setConfirmHide(true)}
          >
            {review.hidden_at ? "Show publicly" : "Hide from profile"}
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4">
          <p className="text-[13px] font-medium text-neutral-500">Review</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {review.body || "—"}
          </p>
        </div>

        <dl className="divide-y divide-neutral-100 border-t border-neutral-100">
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="px-5 py-4 sm:border-r sm:border-neutral-100">
              <dt className="text-[13px] text-neutral-500">Client</dt>
              <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                {review.client_email ?? "—"}
              </dd>
            </div>
            <div className="border-t border-neutral-100 px-5 py-4 sm:border-t-0">
              <dt className="text-[13px] text-neutral-500">Event</dt>
              <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                {review.booking_event_name ?? "—"}
              </dd>
              <p className="mt-0.5 text-xs text-neutral-500">
                {formatReviewEventDate(review.booking_event_date)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-primary/[0.04] px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {review.booking_status ? <StatusBadge status={review.booking_status} /> : null}
              <Link
                href={adminTrustReviewsHref({
                  vendorUserId: review.vendor_user_id,
                  vendorName,
                })}
                className="text-sm font-medium text-primary hover:underline"
              >
                All vendor reviews
              </Link>
            </div>
            <Link
              href={`/admin/bookings/${review.booking_request_id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open booking
            </Link>
          </div>
        </dl>
      </div>

      <ConfirmDialog
        isOpen={confirmHide}
        title={
          review.hidden_at
            ? ADMIN_CONFIRM_COPY.showReview.title
            : ADMIN_CONFIRM_COPY.hideReview.title
        }
        description={
          review.hidden_at
            ? ADMIN_CONFIRM_COPY.showReview.description
            : ADMIN_CONFIRM_COPY.hideReview.description
        }
        confirmLabel={
          review.hidden_at
            ? ADMIN_CONFIRM_COPY.showReview.confirmLabel
            : ADMIN_CONFIRM_COPY.hideReview.confirmLabel
        }
        confirmVariant={review.hidden_at ? "primary" : "destructive"}
        loading={busy}
        onCancel={() => setConfirmHide(false)}
        onConfirm={() => void toggleVisibility()}
      />
    </div>
  );
}
