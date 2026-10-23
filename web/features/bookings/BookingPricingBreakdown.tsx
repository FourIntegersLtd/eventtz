"use client";

import { ChevronDown } from "lucide-react";
import { ClientFeeBreakdownSummary } from "@/features/bookings/ClientFeeBreakdownSummary";
import type { BookingPricing } from "@/lib/domain-types";
import { formatGbp } from "@/lib/money";

export type { BookingPricing } from "@/lib/domain-types";

export type BookingLineItemRow = {
  id: string;
  heading: string;
  unit_price_gbp: number | null;
  description?: string | null;
  feature_lines?: string[];
  timeline_line?: string | null;
  quantity?: number | null;
  unit_rate_gbp?: number | null;
  unit_label?: string | null;
};

/** Price for one included line. A missing price is "TBC"; a discount line keeps its minus sign. */
export function formatLineUnitPrice(unitPriceGbp: number | null, lineId?: string): string {
  if (unitPriceGbp == null) return "TBC";
  const isAutoDiscount =
    (lineId?.startsWith("auto-") ?? false) || unitPriceGbp < 0;
  const formatted = formatGbp(Math.abs(unitPriceGbp), { decimals: "upTo2" });
  return isAutoDiscount ? `-${formatted}` : formatted;
}

/** True for an automatic discount row or any line stored as a negative amount. */
export function isAutoDiscountLine(lineId: string, unitPriceGbp: number | null): boolean {
  return lineId.startsWith("auto-") || (unitPriceGbp != null && unitPriceGbp < 0);
}

type BookingPricingBreakdownProps = {
  quoteTotalLabel: string;
  pricing: BookingPricing | null | undefined;
  variant?: "client" | "vendor";
  /** When set, line items (subtotal) becomes expandable with per-line detail. */
  lineItems?: BookingLineItemRow[];
  /** Strikethrough total shown above the current total when price changed after request. */
  compareTotalLabel?: string | null;
};

/**
 * Flat pricing list (same spirit as browse vendor pricing) -
 * one surface, divided rows, no nested package cards.
 */
export function BookingPricingBreakdown({
  quoteTotalLabel,
  pricing,
  variant = "client",
  lineItems,
  compareTotalLabel,
}: BookingPricingBreakdownProps) {
  if (!pricing) {
    return (
      <div className="rounded-2xl border border-line bg-white px-5 py-5">
        <p className="text-[13px] font-medium text-ink-3">Estimated total</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
          {quoteTotalLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">
            {variant === "client" ? "Pricing" : "Client-facing total"}
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {variant === "vendor"
              ? "What the client sees and what you earn"
              : "What’s included and what you’ll pay"}
          </p>
        </div>
      </div>

      {lineItems && lineItems.length > 0 ? (
        <details className="group border-t border-line" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-surface-3 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
              What&apos;s included
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
            <span className="text-sm font-semibold tabular-nums text-ink">
              {pricing.line_items_subtotal_label}
            </span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {lineItems.map((li) => {
              const isDiscount = isAutoDiscountLine(li.id, li.unit_price_gbp);
              return (
                <li key={li.id} className="px-5 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`min-w-0 text-sm font-medium ${
                        isDiscount ? "text-emerald-800" : "text-ink"
                      }`}
                    >
                      {li.heading}
                      {li.quantity != null &&
                      li.quantity > 0 &&
                      li.unit_rate_gbp != null &&
                      !isDiscount
                        ? ` · ${li.quantity} × ${formatGbp(Math.abs(li.unit_rate_gbp))}${li.unit_label ? ` / ${li.unit_label}` : ""}`
                        : ""}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        isDiscount ? "text-emerald-700" : "text-ink"
                      }`}
                    >
                      {formatLineUnitPrice(li.unit_price_gbp, li.id)}
                    </span>
                  </div>
                  {li.timeline_line ? (
                    <p className="mt-1 text-[13px] text-ink-3">{li.timeline_line}</p>
                  ) : null}
                  {li.description ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-3">
                      {li.description}
                    </p>
                  ) : null}
                  {li.feature_lines && li.feature_lines.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {li.feature_lines.map((line, fIdx) => (
                        <li
                          key={`${li.id}-f-${fIdx}`}
                          className="flex items-start gap-2 text-[13px] text-ink-3"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : (
        <div className="flex justify-between gap-3 border-t border-line px-5 py-3.5 text-sm">
          <span className="text-ink-2">What&apos;s included</span>
          <span className="font-semibold tabular-nums text-ink">
            {pricing.line_items_subtotal_label}
          </span>
        </div>
      )}

      {pricing.vendor_adjustments.length > 0 ? (
        <div className="border-t border-line px-5 py-4">
          <p className="text-[13px] font-medium text-ink-3">Additions and discounts</p>
          <ul className="mt-2.5 space-y-2">
            {pricing.vendor_adjustments.map((a) => {
              const isDiscount = a.amount_gbp < 0;
              const display = isDiscount
                ? formatGbp(-Math.abs(a.amount_gbp), { decimals: 2, grouping: false })
                : formatGbp(a.amount_gbp, { decimals: 2, grouping: false });
              return (
                <li key={a.id} className="flex justify-between gap-2 text-sm text-ink">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2">
                      {a.adjustment_category}
                    </span>
                    <span className="truncate">{a.label}</span>
                  </span>
                  <span
                    className={`shrink-0 font-medium tabular-nums ${isDiscount ? "text-emerald-700" : ""}`}
                  >
                    {display}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {pricing.referral_fee_applied && variant !== "vendor" ? (
        <div className="border-t border-emerald-100 bg-emerald-50/60 px-5 py-3 text-xs text-emerald-900">
          Referral discount applied
          {pricing.referral_fee_discount_label ? (
            <span>: {pricing.referral_fee_discount_label} off your Eventtz fee</span>
          ) : null}
          {pricing.vendor_referral_code ? (
            <span className="text-emerald-800/80"> · Code {pricing.vendor_referral_code}</span>
          ) : null}
        </div>
      ) : null}

      <div
        className={`border-t border-line px-5 py-4 ${
          variant === "vendor" ? "bg-surface-3" : "py-3.5"
        }`}
      >
        <ClientFeeBreakdownSummary
          breakdown={{
            vendorPortionLabel: pricing.vendor_portion_label,
            feeLabel: pricing.service_fee_label,
            totalLabel: pricing.client_total_label,
            feePercent: pricing.service_fee_percent,
            feeBeforeDiscountLabel: pricing.service_fee_before_discount_label,
            referralDiscountLabel: pricing.referral_fee_discount_label,
            referralApplied: pricing.referral_fee_applied,
          }}
          feeDisplay={variant === "vendor" ? "condensed" : "full"}
          showTotal={variant === "vendor"}
          totalHeading="They pay"
          footnote={
            variant === "vendor" && pricing.vendor_referral_code
              ? `Referral code ${pricing.vendor_referral_code}`
              : null
          }
        />
        {variant === "vendor" ? (
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-sm">
            <p className="font-medium text-ink-2">Your payout</p>
            <p className="text-right text-lg font-semibold tabular-nums tracking-tight text-ink">
              {pricing.vendor_portion_label}
            </p>
          </div>
        ) : null}
      </div>

      {variant !== "vendor" ? (
        <div className="border-t border-line bg-surface-3 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-ink-2">Total due</p>
            <p className="text-right text-lg font-semibold tabular-nums tracking-tight text-ink">
              {compareTotalLabel ? (
                <span className="mr-2 text-sm font-normal text-ink-3 line-through">
                  {compareTotalLabel}
                </span>
              ) : null}
              {pricing.client_total_label}
            </p>
          </div>
          {pricing.has_pricing_tbc ? (
            <p className="mt-1.5 text-[12px] text-amber-700">
              Some items are TBC and may change the total.
            </p>
          ) : null}
        </div>
      ) : pricing.has_pricing_tbc ? (
        <div className="border-t border-line bg-surface-3 px-5 py-3">
          <p className="text-[12px] text-amber-700">Some items are TBC and may change the total.</p>
        </div>
      ) : null}
    </div>
  );
}
