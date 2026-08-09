"use client";

import Link from "next/link";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";
import { formatEventDate } from "@/lib/dateFormat";
import {
  fetchVendorPayoutHistory,
  type VendorPayoutRow,
} from "@/lib/vendorPaymentsApi";

function payoutStatusLabel(status: string): string {
  if (status === "paid_out") return "Paid out";
  if (status === "awaiting_payout") return "Awaiting payout";
  return status;
}

function payoutStatusClass(status: string): string {
  if (status === "paid_out") return "bg-emerald-100 text-emerald-900";
  if (status === "awaiting_payout") return "bg-amber-100 text-amber-900";
  return "bg-neutral-100 text-neutral-700";
}

function PayoutStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${payoutStatusClass(status)}`}
    >
      {payoutStatusLabel(status)}
    </span>
  );
}

function PayoutRow({ payout }: { payout: VendorPayoutRow }) {
  return (
    <li>
      <Link
        href={`/vendor/bookings/${payout.booking_id}`}
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-neutral-50/80"
      >
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">{payout.event_name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {payout.client_display_name ?? "Client"}
            {payout.event_date ? ` · ${formatEventDate(payout.event_date)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-neutral-900">
            {payout.amount_label}
          </span>
          <PayoutStatusBadge status={payout.status} />
        </div>
      </Link>
    </li>
  );
}

export function VendorPaymentHistory() {
  const { data, loading, error } = useReviewsQuery(
    fetchVendorPayoutHistory,
    "Could not load payout history.",
  );

  if (loading) {
    return <LoadingState label="Loading payout history…" variant="inline" className="py-10" />;
  }

  if (error) {
    return <LottieFailureInline message={error} />;
  }

  const payouts = data?.payouts ?? [];
  const paidOutLabel = data?.total_paid_out_label ?? "GBP 0";
  const awaitingLabel = data?.total_awaiting_label ?? "GBP 0";

  if (payouts.length === 0) {
    return (
      <LottieEmptyPanel
        variant="payments"
        title="No payouts yet"
        description="Once a client pays and the booking is complete, your earnings show up here — the amount you receive, not the client's total."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Paid out</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">{paidOutLabel}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Awaiting payout
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
            {awaitingLabel}
          </p>
        </div>
      </div>
      <ul className={`divide-y divide-neutral-100 ${portalCard}`}>
        {payouts.map((payout) => (
          <PayoutRow key={payout.booking_id} payout={payout} />
        ))}
      </ul>
    </div>
  );
}
