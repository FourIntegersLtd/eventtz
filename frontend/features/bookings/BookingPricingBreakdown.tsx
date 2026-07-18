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
  /** Strikethrough total shown above the current total when price changed after request. */
  compareTotalLabel?: string | null;
};

/**
 * Flat pricing list (same spirit as browse vendor pricing) —
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
      <div className="rounded-2xl border border-neutral-100 bg-white px-5 py-5">
        <p className="text-[13px] font-medium text-neutral-500">Estimated total</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
          {quoteTotalLabel}
        </p>
      </div>
    );
  }

  const totalLabel =
    variant === "vendor" ? "Your payout" : "Total due";
  const totalValue =
    variant === "vendor" ? pricing.vendor_portion_label : pricing.client_total_label;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            {variant === "client" ? "Pricing" : "Client-facing total"}
          </h3>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            {variant === "vendor"
              ? "What the client sees and what you earn"
              : "What’s included and what you’ll pay"}
          </p>
        </div>
      </div>

      {lineItems && lineItems.length > 0 ? (
        <details className="group border-t border-neutral-100" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-800">
              What&apos;s included
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
            <span className="text-sm font-semibold tabular-nums text-neutral-900">
              {pricing.line_items_subtotal_label}
            </span>
          </summary>
          <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
            {lineItems.map((li) => {
              const isDiscount = isAutoDiscountLine(li.id, li.unit_price_gbp);
              return (
                <li key={li.id} className="px-5 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`min-w-0 text-sm font-medium ${
                        isDiscount ? "text-emerald-800" : "text-neutral-900"
                      }`}
                    >
                      {li.heading}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        isDiscount ? "text-emerald-700" : "text-neutral-900"
                      }`}
                    >
                      {formatLineUnitPrice(li.unit_price_gbp, li.id)}
                    </span>
                  </div>
                  {li.timeline_line ? (
                    <p className="mt-1 text-[13px] text-neutral-500">{li.timeline_line}</p>
                  ) : null}
                  {li.description ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-500">
                      {li.description}
                    </p>
                  ) : null}
                  {li.feature_lines && li.feature_lines.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {li.feature_lines.map((line, fIdx) => (
                        <li
                          key={`${li.id}-f-${fIdx}`}
                          className="flex items-start gap-2 text-[13px] text-neutral-500"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
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
        <div className="flex justify-between gap-3 border-t border-neutral-100 px-5 py-3.5 text-sm">
          <span className="text-neutral-600">What&apos;s included</span>
          <span className="font-semibold tabular-nums text-neutral-900">
            {pricing.line_items_subtotal_label}
          </span>
        </div>
      )}

      {pricing.vendor_adjustments.length > 0 ? (
        <div className="border-t border-neutral-100 px-5 py-4">
          <p className="text-[13px] font-medium text-neutral-500">Additions and discounts</p>
          <ul className="mt-2.5 space-y-2">
            {pricing.vendor_adjustments.map((a) => {
              const isDiscount = a.amount_gbp < 0;
              const display = isDiscount
                ? `-£${Math.abs(a.amount_gbp).toFixed(2)}`
                : `£${a.amount_gbp.toFixed(2)}`;
              return (
                <li key={a.id} className="flex justify-between gap-2 text-sm text-neutral-800">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                      {a.tag}
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

      {variant === "client" ? (
        <div className="space-y-2 border-t border-neutral-100 px-5 py-3.5 text-sm">
          <div className="flex justify-between gap-2 text-neutral-600">
            <span>Vendor portion</span>
            <span className="font-medium tabular-nums text-neutral-900">
              {pricing.vendor_portion_label}
            </span>
          </div>
          <div className="flex justify-between gap-2 text-neutral-600">
            <span>
              Eventtz fee
              <span className="text-neutral-400"> ({pricing.service_fee_percent}%)</span>
            </span>
            <span className="font-medium tabular-nums text-neutral-900">
              {pricing.service_fee_label}
            </span>
          </div>
        </div>
      ) : null}

      {/* Highlighted total — pops without nested cards */}
      <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-neutral-700">{totalLabel}</p>
          <p className="text-right text-lg font-semibold tabular-nums tracking-tight text-neutral-900">
            {compareTotalLabel && variant === "client" ? (
              <span className="mr-2 text-sm font-normal text-neutral-400 line-through">
                {compareTotalLabel}
              </span>
            ) : null}
            {totalValue}
          </p>
        </div>
        {pricing.has_pricing_tbc ? (
          <p className="mt-1.5 text-[12px] text-amber-700">
            Some items are TBC and may change the total.
          </p>
        ) : null}
      </div>
    </div>
  );
}
