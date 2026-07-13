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
import { adminCard } from "@/features/admin/adminTheme";
import {
  adminTrustReviewsHref,
  formatReviewEventDate,
  formatReviewWhen,
} from "./reviewFormatters";

type Props = {
  reviewId: string;
};

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${adminCard} p-5`}>
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

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
      <nav className="text-sm text-neutral-600">
        <Link href={backHref} className="text-primary hover:underline">
          Reviews
        </Link>
        <span className="mx-2 text-neutral-400">/</span>
        <span className="text-neutral-900">{vendorName}</span>
      </nav>

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

      <DetailSection title="Review">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
          {review.body || "—"}
        </p>
      </DetailSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailSection title="Vendor">
          <dl className="space-y-4">
            <Field label="Business" value={vendorName} />
            <Field
              label="All reviews"
              value={
                <Link
                  href={adminTrustReviewsHref({
                    vendorUserId: review.vendor_user_id,
                    vendorName,
                  })}
                  className="font-medium text-primary hover:underline"
                >
                  View vendor reviews
                </Link>
              }
            />
          </dl>
        </DetailSection>

        <DetailSection title="Client">
          <dl className="space-y-4">
            <Field label="Email" value={review.client_email ?? "—"} />
          </dl>
        </DetailSection>
      </div>

      <DetailSection title="Booking">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Event" value={review.booking_event_name ?? "—"} />
          <Field label="Event date" value={formatReviewEventDate(review.booking_event_date)} />
          <Field
            label="Status"
            value={
              review.booking_status ? (
                <StatusBadge status={review.booking_status} />
              ) : (
                "—"
              )
            }
          />
          <Field
            label="Booking"
            value={
              <Link
                href={`/admin/bookings/${review.booking_request_id}`}
                className="font-medium text-primary hover:underline"
              >
                Open booking
              </Link>
            }
          />
        </dl>
      </DetailSection>

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
