"use client";

export type ClientFeeBreakdownLabels = {
  vendorPortionLabel: string;
  feeLabel: string;
  totalLabel: string;
  feePercent: number;
  feeBeforeDiscountLabel?: string | null;
  referralDiscountLabel?: string | null;
  referralApplied?: boolean;
};

type ClientFeeBreakdownSummaryProps = {
  breakdown: ClientFeeBreakdownLabels;
  totalHeading?: "Estimated total" | "Total due" | "They pay";
  footnote?: string | null;
  compact?: boolean;
  /** When false, only vendor portion + fee rows (e.g. inside BookingPricingBreakdown). */
  showTotal?: boolean;
  /** Collapse referral strikethrough rows into one fee line. */
  feeDisplay?: "full" | "condensed";
  className?: string;
};

export function ClientFeeBreakdownSummary({
  breakdown,
  totalHeading = "Estimated total",
  footnote,
  compact = false,
  showTotal = true,
  feeDisplay = "full",
  className = "",
}: ClientFeeBreakdownSummaryProps) {
  const rowText = compact ? "text-[13px]" : "text-sm";
  const totalText = compact ? "text-sm" : "text-sm";
  const totalValue = compact ? "text-base font-semibold" : "font-heading text-lg font-semibold";
  const showReferralRows =
    feeDisplay === "full" &&
    breakdown.referralApplied &&
    breakdown.feeBeforeDiscountLabel &&
    breakdown.referralDiscountLabel;
  const referralOffLabel = breakdown.referralDiscountLabel?.replace(/^-/, "") ?? null;
  const showCondensedReferralFee =
    feeDisplay === "condensed" &&
    breakdown.referralApplied &&
    referralOffLabel;

  return (
    <div className={className}>
      <div className={`space-y-2 ${rowText}`}>
        <div className="flex justify-between gap-2 text-ink-2">
          <span>Vendor portion</span>
          <span className="font-medium tabular-nums text-ink">
            {breakdown.vendorPortionLabel}
          </span>
        </div>
        {showCondensedReferralFee ? (
          <div className="flex justify-between gap-2 text-ink-2">
            <span>
              Eventtz fee
              <span className="text-ink-3">
                {" "}
                ({breakdown.feePercent}%, {referralOffLabel} referral off)
              </span>
            </span>
            <span className="font-medium tabular-nums text-ink">
              {breakdown.feeLabel}
            </span>
          </div>
        ) : showReferralRows ? (
          <>
            <div className="flex justify-between gap-2 text-ink-2">
              <span>
                Eventtz fee
                <span className="text-ink-3"> ({breakdown.feePercent}%)</span>
              </span>
              <span className="font-medium tabular-nums text-ink-3 line-through">
                {breakdown.feeBeforeDiscountLabel}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-emerald-800">
              <span>Referral discount</span>
              <span className="font-medium tabular-nums">{breakdown.referralDiscountLabel}</span>
            </div>
            <div className="flex justify-between gap-2 text-ink-2">
              <span>Eventtz fee due</span>
              <span className="font-medium tabular-nums text-ink">
                {breakdown.feeLabel}
              </span>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-2 text-ink-2">
            <span>
              Eventtz fee
              <span className="text-ink-3"> ({breakdown.feePercent}%)</span>
            </span>
            <span className="font-medium tabular-nums text-ink">
              {breakdown.feeLabel}
            </span>
          </div>
        )}
      </div>

      {showTotal ? (
        <div
          className={`flex items-center justify-between border-t border-line pt-2 ${
            compact ? "mt-2" : "mt-3"
          } ${totalText}`}
        >
          <span className="font-medium text-ink-2">{totalHeading}</span>
          <span className={`tabular-nums text-ink ${totalValue}`}>
            {breakdown.totalLabel}
          </span>
        </div>
      ) : null}

      {footnote ? (
        <p className={`mt-2 text-xs text-ink-3 ${compact ? "leading-snug" : ""}`}>
          {footnote}
        </p>
      ) : null}
    </div>
  );
}
