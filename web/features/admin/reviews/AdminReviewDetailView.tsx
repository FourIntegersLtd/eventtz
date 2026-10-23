"use client";

import { DescriptionList } from "@/components/ui/DescriptionList";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BackLink } from "@/components/ui/BackLink";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ADMIN_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { ReviewVisibilityBadge } from "@/components/badges/ReviewVisibilityBadge";
import { StarRating } from "@/components/ui/StarRating";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import {
  fetchAdminReview,
  patchReviewVisibility,
  type AdminReviewRow,
} from "@/lib/adminPlatformApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminBookingRef } from "@/features/admin/bookings/adminBookingRef";
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
  const { showToast } = useToast();
  const [review, setReview] = useState<AdminReviewRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      setReview(await fetchAdminReview(reviewId));
    } catch {
      setLoadError("Could not load review.");
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
    setActionError(null);
    const showPublicly = Boolean(review.hidden_at);
    try {
      await patchReviewVisibility(review.id, !review.hidden_at);
      setConfirmHide(false);
      await load();
      showToast({
        title: showPublicly ? "Review shown publicly" : "Review hidden",
        tone: "success",
      });
    } catch (e: unknown) {
      const message = getApiErrorDetail(e) ?? "Could not update review visibility.";
      setActionError(message);
      showToast({ title: "Update failed", description: message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading review…" rows={2} />;
  }

  if (loadError || !review) {
    return <AdminErrorBanner message={loadError ?? "Not found."} />;
  }

  const vendorName = review.vendor_display_name ?? "Vendor";
  const backHref = adminTrustReviewsHref({
    vendorUserId: review.vendor_user_id,
    vendorName,
  });

  return (
    <div className="ez-stack ez-stack--lg">
      <BackLink href={backHref} label="Reviews" icon="chevron" tone="muted" />
      {actionError ? <AdminErrorBanner message={actionError} /> : null}

      <div className="ez-pagehead">
        <div className="ez-pagehead__text">
          <h1 className="ez-h1">Review of {vendorName}</h1>
          <p className="ez-small">
            {review.rating} star{review.rating === 1 ? "" : "s"} · {review.client_email ?? "Client"}
          </p>
        </div>
        {canModerateReviews ? (
          <div className="ez-pagehead__actions">
            <Button
              variant={review.hidden_at ? "primary" : "destructive"}
              size="sm"
              loading={busy}
              onClick={() => setConfirmHide(true)}
            >
              {review.hidden_at ? "Show publicly" : "Hide from profile"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <section className="ez-card">
            <div className="ez-card__head">
              <h2 className="ez-h3">Review</h2>
              <ReviewVisibilityBadge hidden={Boolean(review.hidden_at)} />
            </div>
            <div className="ez-card__body">
              <div className="ez-stack">
                <StarRating rating={review.rating} size="md" />
                <p className="ez-body whitespace-pre-wrap">{review.body || "-"}</p>
                <p className="ez-caption">
                  Posted {formatReviewWhen(review.created_at)} by {review.client_email ?? "client"}{" "}
                  for booking {adminBookingRef(review.booking_request_id)}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="ez-split__aside ez-stack ez-stack--lg">
          <section className="ez-card">
            <div className="ez-card__head">
              <h2 className="ez-h3">Booking</h2>
            </div>
            <div className="ez-card__body">
              <DescriptionList
                items={[
                  { label: "Event", value: review.booking_event_name ?? "-" },
                  { label: "Event date", value: formatReviewEventDate(review.booking_event_date) },
                  {
                    label: "Request status",
                    value: review.booking_status ? <StatusBadge status={review.booking_status} /> : "-",
                  },
                ]}
              />
              <div className="ez-hrow" style={{ marginTop: "12px" }}>
                <Link
                  href={`/admin/bookings/${review.booking_request_id}`}
                  className="ez-btn ez-btn--secondary ez-btn--sm"
                >
                  Open booking
                </Link>
                <Link href={backHref} className="ez-btn ez-btn--ghost ez-btn--sm">
                  All vendor reviews
                </Link>
              </div>
            </div>
          </section>
        </div>
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
        lottie={review.hidden_at ? "successCheck" : "failure"}
        loading={busy}
        onCancel={() => setConfirmHide(false)}
        onConfirm={() => void toggleVisibility()}
      />
    </div>
  );
}
