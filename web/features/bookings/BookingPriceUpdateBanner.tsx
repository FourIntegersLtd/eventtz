"use client";

import { Button } from "@/components/ui/Button";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { ClientFeeBreakdownSummary } from "@/features/bookings/ClientFeeBreakdownSummary";
import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";
import { formatGbp } from "@/lib/money";

type BookingPriceUpdateBannerProps = {
  wasTotalLabel: string;
  nowTotalLabel: string;
  pricing: BookingPricing | null | undefined;
  actionBusy: boolean;
  pendingAction: null | "accept" | "decline";
  onAccept: () => void;
  onDecline: () => void;
};

export function BookingPriceUpdateBanner({
  wasTotalLabel,
  nowTotalLabel,
  pricing,
  actionBusy,
  pendingAction,
  onAccept,
  onDecline,
}: BookingPriceUpdateBannerProps) {
  const adjustments = pricing?.vendor_adjustments ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/40">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <LottieIllustration asset="pendingReview" size="inline" ariaLabel="" />
          <p className="pt-1 text-[15px] font-semibold tracking-tight text-ink">
            New price from your vendor
          </p>
        </div>
        {adjustments.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-300/80 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              Why the price changed
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {adjustments.map((adjustment) => (
                <li key={adjustment.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{adjustment.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">
                    {formatGbp(adjustment.amount_gbp, { showPlus: true })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm text-ink-3">
            Was:{" "}
            <span className="font-medium text-ink-2 line-through">{wasTotalLabel}</span>
          </span>
          <span className="text-sm font-semibold text-ink-3" aria-hidden>
            →
          </span>
          <span className="text-sm font-semibold text-ink">Now: {nowTotalLabel}</span>
        </div>

        {pricing && !pricing.has_pricing_tbc ? (
          <div className="mt-3 rounded-lg border border-line bg-white/70 px-3 py-2.5">
            <ClientFeeBreakdownSummary
              breakdown={{
                vendorPortionLabel: pricing.vendor_portion_label,
                feeLabel: pricing.service_fee_label,
                totalLabel: pricing.client_total_label,
                feePercent: pricing.service_fee_percent,
              }}
              totalHeading="Total due"
              compact
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-primary/[0.04] px-5 py-4 sm:flex-row sm:justify-end">
        <Button
          variant="primary"
          size="sm"
          className="w-full sm:w-auto"
          disabled={actionBusy}
          loading={pendingAction === "accept"}
          onClick={onAccept}
        >
          Accept new price
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="w-full sm:w-auto"
          disabled={actionBusy}
          loading={pendingAction === "decline"}
          onClick={onDecline}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
