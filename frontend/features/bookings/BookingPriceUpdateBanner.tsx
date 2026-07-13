"use client";

import { Button } from "@/components/ui/Button";
import type { BookingPricing } from "@/features/bookings/BookingPricingBreakdown";

type BookingPriceUpdateBannerProps = {
  wasTotalLabel: string;
  nowTotalLabel: string;
  pricing: BookingPricing | null | undefined;
  actionBusy: boolean;
  pendingAction: null | "accept" | "decline";
  onAccept: () => void;
  onDecline: () => void;
};

function formatAdjustmentAmount(amountGbp: number): string {
  const abs = Math.abs(amountGbp);
  const formatted = abs.toLocaleString("en-GB", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return amountGbp < 0 ? `-£${formatted}` : `+£${formatted}`;
}

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
    <div className="rounded-2xl border border-primary-border bg-primary-soft/30 px-5 py-5 shadow-sm">
      <p className="font-heading text-lg font-semibold text-primary">New price from your vendor</p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm text-neutral-500">
          Was:{" "}
          <span className="font-medium text-neutral-600 line-through">{wasTotalLabel}</span>
        </span>
        <span className="text-sm font-semibold text-neutral-400" aria-hidden>
          →
        </span>
        <span className="text-sm font-semibold text-neutral-900">Now: {nowTotalLabel}</span>
      </div>

      {adjustments.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm text-neutral-700">
          {adjustments.map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden />
              <span>
                {a.label}: {formatAdjustmentAmount(a.amount_gbp)}
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-neutral-500">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-300" aria-hidden />
            <span>Eventtz fee included</span>
          </li>
        </ul>
      ) : null}

      <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
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
