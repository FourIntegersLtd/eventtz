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
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="px-5 py-4">
        <p className="text-[15px] font-semibold tracking-tight text-neutral-900">
          New price from your vendor
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
          <ul className="mt-3 space-y-1.5 text-[13px] text-neutral-600">
            {adjustments.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden />
                <span>
                  {a.label}: {formatAdjustmentAmount(a.amount_gbp)}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-neutral-400">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-300" aria-hidden />
              <span>Eventtz fee included</span>
            </li>
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-100 bg-primary/[0.04] px-5 py-4 sm:flex-row sm:justify-end">
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
