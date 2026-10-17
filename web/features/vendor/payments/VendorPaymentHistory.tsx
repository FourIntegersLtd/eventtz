"use client";

import Link from "next/link";
import { ArrowUpRight, Banknote, Clock3, PiggyBank, Wallet } from "lucide-react";
import { AdminKpiCard } from "@/features/admin/components/AdminKpiCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieEmptyPanel } from "@/components/ui/LottieEmptyPanel";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { useReviewsQuery } from "@/features/reviews/useReviewsQuery";
import { formatEventDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/markets";
import {
  fetchVendorPayoutHistory,
  type VendorPayoutHistory,
  type VendorPayoutRow,
} from "@/lib/vendorPaymentsApi";
import { ReceiptActions } from "@/features/receipts/ReceiptActions";

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

function formatPaidOutDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function payoutCounts(data: VendorPayoutHistory | null) {
  const rows = data?.payouts ?? [];
  const paidOut = rows.filter((p) => p.status === "paid_out");
  const awaiting = rows.filter((p) => p.status === "awaiting_payout");
  return { paidOut, awaiting, total: rows.length };
}

function PayoutSummaryCards({ data }: { data: VendorPayoutHistory | null }) {
  const { paidOut, awaiting } = payoutCounts(data);
  const paidOutLabel = data?.total_paid_out_label ?? "GBP 0";
  const awaitingLabel = data?.total_awaiting_label ?? "GBP 0";
  const totalGbp = (data?.total_paid_out_gbp ?? 0) + (data?.total_awaiting_gbp ?? 0);
  const totalLabel = formatMoney(totalGbp);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AdminKpiCard
        label="Paid out"
        value={paidOutLabel}
        hint={
          paidOut.length === 0
            ? "Sent to your bank after completion"
            : `${paidOut.length} booking${paidOut.length === 1 ? "" : "s"} in your account`
        }
        icon={Wallet}
        tone="success"
      />
      <AdminKpiCard
        label="Awaiting payout"
        value={awaitingLabel}
        hint={
          awaiting.length === 0
            ? "Held until both sides confirm the event"
            : `${awaiting.length} booking${awaiting.length === 1 ? "" : "s"} ready to release`
        }
        icon={Clock3}
        tone="warning"
      />
      <AdminKpiCard
        label="Total earnings"
        value={totalLabel}
        hint="Your share from paid bookings — not the client total"
        icon={PiggyBank}
        tone="primary"
      />
    </div>
  );
}

function PayoutListCard({ payout }: { payout: VendorPayoutRow }) {
  const paidOutOn = formatPaidOutDate(payout.paid_out_at);

  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/vendor/bookings/${payout.booking_id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-base font-semibold text-neutral-900">{payout.event_name}</p>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${payoutStatusClass(payout.status)}`}
          >
            {payoutStatusLabel(payout.status)}
          </span>
          {payout.kind === "cancellation_share" ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
              Cancellation share
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          {payout.client_display_name ?? "Client"}
          {payout.event_date ? ` · ${formatEventDate(payout.event_date)}` : ""}
        </p>
        {paidOutOn ? (
          <p className="mt-1 text-xs text-neutral-400">Paid out {paidOutOn}</p>
        ) : payout.status === "awaiting_payout" ? (
          <p className="mt-1 text-xs text-neutral-400">Released when the booking is complete</p>
        ) : null}
      </Link>

      <div className="flex shrink-0 flex-col items-end justify-center gap-2">
        <p className="font-heading text-xl font-semibold tabular-nums text-neutral-900">
          {payout.amount_label}
        </p>
        {payout.status === "paid_out" ? (
          <ReceiptActions
            bookingId={payout.booking_id}
            documentType="vendor_payout_statement"
            compact
          />
        ) : null}
        <Link
          href={`/vendor/bookings/${payout.booking_id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100"
        >
          View booking
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function VendorPaymentHistory() {
  const { data, loading, error } = useReviewsQuery(
    fetchVendorPayoutHistory,
    "Could not load payout history.",
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[108px] animate-pulse rounded-2xl border border-neutral-200/80 bg-neutral-100/80"
            />
          ))}
        </div>
        <LoadingState label="Loading payout history…" variant="inline" className="py-6" />
      </div>
    );
  }

  if (error) {
    return <LottieFailureInline message={error} />;
  }

  const payouts = data?.payouts ?? [];

  return (
    <div className="space-y-8">
      <PayoutSummaryCards data={data} />

      {payouts.length === 0 ? (
        <LottieEmptyPanel
          variant="payments"
          title="No payouts yet"
          description="Once a client pays, your earnings show up here — the amount you receive, not the client's total."
        />
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
              <Banknote className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-heading text-base font-semibold text-neutral-900">
                Recent payouts
              </h2>
              <p className="text-sm text-neutral-500">
                Amounts are your share only — Eventtz service fees are not included.
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {payouts.map((payout) => (
              <li key={payout.booking_id}>
                <PayoutListCard payout={payout} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
