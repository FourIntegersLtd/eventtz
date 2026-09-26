"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Spinner } from "@/foundation/ui";
import { GENERIC_ERROR_MESSAGE, platformErrorDetail } from "@/foundation/platform-client";
import { fetchVendorDispute, type DisputePublic } from "@/domains/vendor-disputes/api";
import { disputeStatusLabel, formatEventDate } from "@/domains/vendor-disputes/format";

/** `/vendor/disputes/[disputeId]` — one dispute's full detail. */
export function DisputeDetailView({ disputeId }: { disputeId: string }) {
  const [dispute, setDispute] = useState<DisputePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVendorDispute(disputeId)
      .then((result) => {
        if (!cancelled) setDispute(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [disputeId]);

  if (loading) return <Spinner label="Loading dispute…" />;

  if (error || !dispute) {
    return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error ?? "Dispute not found."}</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{dispute.event_name ?? "Booking dispute"}</h2>
            <p className="text-sm text-neutral-500">{formatEventDate(dispute.event_date)}</p>
          </div>
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
            {disputeStatusLabel(dispute.status)}
          </span>
        </div>

        <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
          <p className="text-xs font-medium text-neutral-500">
            {dispute.opened_by_you ? "Opened by you" : `Opened by ${dispute.opened_by_display_name ?? "the other party"}`}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{dispute.summary}</p>
        </div>

        {dispute.resolution_note ? (
          <div className="mt-3 rounded-xl bg-primary-soft p-3 text-sm text-primary">
            <p className="text-xs font-medium">Resolution</p>
            <p className="mt-1 whitespace-pre-wrap">{dispute.resolution_note}</p>
          </div>
        ) : null}

        {dispute.counterparty_label ? (
          <p className="mt-3 text-sm text-neutral-600">Other party: {dispute.counterparty_label}</p>
        ) : null}

        <Link href={`/vendor/bookings/${dispute.booking_request_id}`} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          View the booking
        </Link>
      </Card>
    </div>
  );
}
