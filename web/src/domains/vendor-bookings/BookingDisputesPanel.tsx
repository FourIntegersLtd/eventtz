"use client";

import { useEffect, useState } from "react";
import { Button } from "@/foundation/ui";
import { GENERIC_ERROR_MESSAGE, hasCode, platformErrorDetail } from "@/foundation/platform-client";
import { disputeStatusLabel } from "@/domains/vendor-bookings/format";
import { fetchVendorBookingDisputes, postVendorBookingDispute, type DisputePublic } from "@/domains/vendor-bookings/api";

/**
 * Disputes already opened on this booking, plus a form to open a new one.
 * Filing from a booking (rather than only from the standalone disputes
 * list) is the flow the baseline exposes on the booking detail screen.
 */
export function BookingDisputesPanel({ bookingId }: { bookingId: string }) {
  const [disputes, setDisputes] = useState<DisputePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVendorBookingDisputes(bookingId)
      .then((rows) => {
        if (!cancelled) setDisputes(rows);
      })
      .catch(() => {
        // A vendor who isn't a party to this booking sees an empty list, not an error banner.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  async function openDispute() {
    if (!summary.trim()) {
      setFormError("Describe what went wrong first.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const opened = await postVendorBookingDispute(bookingId, summary.trim());
      setDisputes((current) => [opened, ...current]);
      setSummary("");
    } catch (cause: unknown) {
      if (hasCode(cause, "dispute_already_open")) {
        setFormError("There is already an open dispute on this booking.");
      } else {
        setFormError(platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const hasOpenDispute = disputes.some((dispute) => dispute.status === "open" || dispute.status === "under_review");

  return (
    <div className="space-y-3">
      {disputes.map((dispute) => (
        <div key={dispute.id} className="rounded-xl bg-neutral-50 p-3 text-sm">
          <p className="font-medium text-neutral-900">{disputeStatusLabel(dispute.status)}</p>
          <p className="mt-1 text-neutral-600">{dispute.summary}</p>
        </div>
      ))}

      {!hasOpenDispute ? (
        <div className="space-y-2">
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Describe what went wrong"
            rows={3}
            className="w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
          />
          {formError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{formError}</p>
          ) : null}
          <Button type="button" variant="secondary" loading={submitting} onClick={() => void openDispute()}>
            Open a dispute
          </Button>
        </div>
      ) : null}
    </div>
  );
}
