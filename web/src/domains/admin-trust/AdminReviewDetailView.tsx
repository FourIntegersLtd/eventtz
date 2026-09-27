"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/foundation/ui";
import { AdminErrorBanner, AdminLoadingState, AdminSuccessBanner, formatDate } from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { fetchAdminReview, setAdminReviewVisibility, type AdminReviewRow } from "@/domains/admin-trust/api";

/** `/admin/trust/reviews/[id]` — one review's moderation screen. Any admin may hide/unhide. */
export function AdminReviewDetailView({ reviewId }: { reviewId: string }) {
  const [review, setReview] = useState<AdminReviewRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const row = await fetchAdminReview(reviewId);
      if (mySeq !== requestSeq.current) return;
      setReview(row);
    } catch (cause) {
      if (mySeq !== requestSeq.current) return;
      setError(isPlatformError(cause) ? cause.detail : "Not found.");
    } finally {
      if (mySeq !== requestSeq.current) return;
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleToggleVisibility() {
    if (!review) return;
    setSaving(true);
    setNotice(null);
    try {
      await setAdminReviewVisibility(reviewId, !review.hidden_at);
      await load();
      setNotice(review.hidden_at ? "Review unhidden." : "Review hidden.");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "That didn't work. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminLoadingState label="Loading review…" />;
  if (error || !review) return <AdminErrorBanner message={error ?? "Not found."} />;

  return (
    <div className="max-w-2xl space-y-4">
      {notice ? <AdminSuccessBanner message={notice} /> : null}
      <div className="rounded-2xl border border-primary-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">{review.vendor_display_name}</h2>
          <span className="text-lg text-amber-500">{"★".repeat(review.rating)}</span>
        </div>
        <p className="mt-2 text-sm text-neutral-700">{review.body}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">Client</dt>
          <dd className="text-neutral-900">{review.client_email ?? "-"}</dd>
          <dt className="text-neutral-500">Event</dt>
          <dd className="text-neutral-900">{review.booking_event_name ?? "-"}</dd>
          <dt className="text-neutral-500">Left</dt>
          <dd className="text-neutral-900">{formatDate(review.created_at)}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd className="text-neutral-900">{review.hidden_at ? `Hidden ${formatDate(review.hidden_at)}` : "Visible"}</dd>
        </dl>
        <div className="mt-4">
          <Button variant="secondary" loading={saving} onClick={() => void handleToggleVisibility()}>
            {review.hidden_at ? "Unhide review" : "Hide review"}
          </Button>
        </div>
      </div>
    </div>
  );
}
