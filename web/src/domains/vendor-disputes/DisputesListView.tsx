"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Spinner } from "@/foundation/ui";
import { GENERIC_ERROR_MESSAGE, platformErrorDetail } from "@/foundation/platform-client";
import { fetchVendorDisputes, type DisputePublic } from "@/domains/vendor-disputes/api";
import { disputeStatusLabel, formatEventDate } from "@/domains/vendor-disputes/format";

/** `/vendor/disputes` — every dispute the vendor is party to, most recently opened first. */
export function DisputesListView() {
  const [disputes, setDisputes] = useState<DisputePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVendorDisputes()
      .then((rows) => {
        if (!cancelled) setDisputes(rows);
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
  }, []);

  if (loading) return <Spinner label="Loading disputes…" />;

  if (error) {
    return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>;
  }

  if (disputes.length === 0) {
    return (
      <Card>
        <p className="text-sm text-neutral-600">No disputes on your bookings.</p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {disputes.map((dispute) => (
        <li key={dispute.id}>
          <Link href={`/vendor/disputes/${dispute.id}`} className="block">
            <Card className="transition hover:ring-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">{dispute.event_name ?? "Booking dispute"}</p>
                  <p className="text-sm text-neutral-500">{formatEventDate(dispute.event_date)}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{dispute.summary}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                  {disputeStatusLabel(dispute.status)}
                </span>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
