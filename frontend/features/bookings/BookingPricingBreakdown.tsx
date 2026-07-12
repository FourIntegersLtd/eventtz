"use client";

import { ChevronDown } from "lucide-react";

export type BookingPricing = {
  line_items_subtotal_gbp: number;
  vendor_adjustments: {
    id: string;
    tag: string;
    label: string;
    amount_gbp: number;
  }[];
  adjustments_total_gbp: number;
  vendor_portion_gbp: number;
  service_fee_percent: number;
  service_fee_gbp: number;
  client_total_gbp: number;
  has_pricing_tbc: boolean;
  vendor_portion_label: string;
  service_fee_label: string;
  client_total_label: string;
  line_items_subtotal_label: string;
};

export type BookingLineItemRow = {
  id: string;
  heading: string;
  unit_price_gbp: number | null;
  description?: string | null;
  feature_lines?: string[];
  timeline_line?: string | null;
};

function formatLineUnitPrice(unitPriceGbp: number | null, lineId?: string): string {
  if (unitPriceGbp == null) return "TBC";
  const isAutoDiscount =
    (lineId?.startsWith("auto-") ?? false) || unitPriceGbp < 0;
  const abs = Math.abs(unitPriceGbp);
  const formatted = abs.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return isAutoDiscount ? `-£${formatted}` : `£${formatted}`;
}

function isAutoDiscountLine(lineId: string, unitPriceGbp: number | null): boolean {
  return lineId.startsWith("auto-") || (unitPriceGbp != null && unitPriceGbp < 0);
}

type BookingPricingBreakdownProps = {
  quoteTotalLabel: string;
  pricing: BookingPricing | null | undefined;
  variant?: "client" | "vendor";
  /** When set, line items (subtotal) becomes expandable with per-line detail. */
  lineItems?: BookingLineItemRow[];
};

export function BookingPricingBreakdown({
  quoteTotalLabel,
  pricing,
  variant = "client",
  lineItems,
}: BookingPricingBreakdownProps) {
  if (!pricing) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Estimated total
        </p>
        <p className="mt-1 font-heading text-2xl font-bold text-neutral-900">{quoteTotalLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-neutral-200/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {variant === "client" ? "Pricing breakdown" : "Client-facing total"}
      </p>
      <div className="space-y-4 text-sm">
        {lineItems && lineItems.length > 0 ? (
          <details className="group" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl bg-white px-5 py-4 text-neutral-700 shadow-sm ring-1 ring-neutral-200/50 transition hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-medium text-neutral-900">What&apos;s included</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {pricing.line_items_subtotal_label}
              </span>
            </summary>
            <div className="mt-3 rounded-2xl bg-neutral-50/50 px-5 py-5 ring-1 ring-neutral-200/50">
              <ul className="space-y-5">
                {lineItems.map((li, idx) => {
                  const isDiscount = isAutoDiscountLine(li.id, li.unit_price_gbp);
                  return (
                  <li key={li.id} className={idx > 0 ? "border-t border-neutral-200/50 pt-5" : ""}>
                    <div className="flex justify-between gap-3">
                      <span
                        className={`min-w-0 font-medium ${
                          isDiscount ? "text-emerald-800" : "text-neutral-900"
                        }`}
                      >
                        {li.heading}
                      </span>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${
                          isDiscount ? "text-emerald-700" : "text-neutral-900"
                        }`}
                      >
                        {formatLineUnitPrice(li.unit_price_gbp, li.id)}
                      </span>
                    </div>
                    {li.timeline_line ? (
                      <p className="mt-1 text-sm text-neutral-500">{li.timeline_line}</p>
                    ) : null}
                    {li.description ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
                        {li.description}
                      </p>
                    ) : null}
                    {li.feature_lines && li.feature_lines.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {li.feature_lines.map((line, fIdx) => (
                          <li key={`${li.id}-f-${fIdx}`} className="flex items-start gap-2 text-sm text-neutral-600">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            </div>
          </details>
        ) : (
          <div className="flex justify-between gap-2 px-1 text-neutral-700">
            <span>What&apos;s included</span>
            <span className="font-medium tabular-nums text-neutral-900">
              {pricing.line_items_subtotal_label}
            </span>
          </div>
        )}
        {pricing.vendor_adjustments.length > 0 ? (
          <div className="border-t border-neutral-200/50 px-1 pt-5">
            <p className="text-xs font-medium text-neutral-500">Additions &amp; discounts</p>
            <ul className="mt-3 space-y-2.5">
              {pricing.vendor_adjustments.map((a) => {
                const isDiscount = a.amount_gbp < 0;
                const display = isDiscount
                  ? `-£${Math.abs(a.amount_gbp).toFixed(2)}`
                  : `£${a.amount_gbp.toFixed(2)}`;
                return (
                  <li key={a.id} className="flex justify-between gap-2 text-neutral-800">
                    <span className="flex items-center gap-2">
                      <span className="rounded-md bg-neutral-200/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                        {a.tag}
                      </span>
                      {a.label}
                      {isDiscount && a.tag !== "discount" ? (
                        <span className="text-[10px] font-medium text-emerald-700">
                          (discount)
                        </span>
                      ) : null}
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
        {variant === "vendor" ? (
          <div className="flex justify-between gap-2 border-t border-neutral-200/50 px-1 pt-5 font-heading text-xl font-bold text-neutral-900">
            <span className="flex items-center gap-2 font-heading">
              Your payout
              <span className="hidden text-xs font-normal text-neutral-500 sm:inline">(subtotal ± adjustments)</span>
            </span>
            <span className="tabular-nums text-neutral-900">{pricing.vendor_portion_label}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between gap-2 border-t border-neutral-200/50 px-1 pt-5 font-medium text-neutral-900">
              <span className="flex items-center gap-2">
                Vendor portion
                <span className="hidden text-xs font-normal text-neutral-500 sm:inline">(subtotal ± adjustments)</span>
              </span>
              <span className="font-semibold tabular-nums text-neutral-900">{pricing.vendor_portion_label}</span>
            </div>
            <div className="flex justify-between gap-2 px-1 pt-3 text-neutral-600">
              <span className="flex items-center gap-2">
                Eventtz service fee
                <span className="text-xs text-neutral-500">({pricing.service_fee_percent}%)</span>
              </span>
              <span className="font-semibold tabular-nums text-neutral-900">{pricing.service_fee_label}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-neutral-200/50 px-1 pt-5 font-heading text-xl font-bold text-neutral-900">
              <span>Total due</span>
              <span className="tabular-nums text-neutral-900">{pricing.client_total_label}</span>
            </div>
          </>
        )}
        {pricing.has_pricing_tbc ? (
          <p className="px-1 pt-2 text-xs text-amber-700">
            Some lines are “TBC” — final totals may change when the vendor confirms numbers.
          </p>
        ) : null}
      </div>
    </div>
  );
}
