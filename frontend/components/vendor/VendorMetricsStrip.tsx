"use client";

import { CalendarCheck, Clock, Percent, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  buildVendorMetricItems,
  type VendorPublicMetrics,
} from "@/lib/vendorMetrics";

const ICONS: Record<string, LucideIcon> = {
  rating: Star,
  completed: CalendarCheck,
  response: Clock,
  conversion: Percent,
};

type VendorMetricsStripProps = {
  metrics: VendorPublicMetrics;
  /** Include star rating in the strip (default true). */
  includeRating?: boolean;
  /** `detail` = larger cards; `compact` = inline chips for listing cards. */
  variant?: "detail" | "compact";
  className?: string;
};

/**
 * Reusable public vendor stats (rating, completed events, reply time, conversion).
 * Plug into browse detail, marketplace cards, or admin previews.
 */
export function VendorMetricsStrip({
  metrics,
  includeRating = true,
  variant = "detail",
  className = "",
}: VendorMetricsStripProps) {
  const items = buildVendorMetricItems(metrics, { includeRating });
  if (items.length === 0) return null;

  if (variant === "compact") {
    return (
      <ul
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600 ${className}`.trim()}
      >
        {items.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <li key={item.key} className="inline-flex min-w-0 items-center gap-1">
              {Icon ? (
                <Icon className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
              ) : null}
              <span className="font-medium tabular-nums text-neutral-800">{item.value}</span>
              <span className="text-neutral-400">{item.label}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`.trim()}
      aria-label="Vendor stats"
    >
      {items.map((item) => {
        const Icon = ICONS[item.key];
        return (
          <li
            key={item.key}
            className="rounded-xl border border-neutral-100 bg-white px-3.5 py-3"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              {item.label}
            </div>
            <p className="mt-1.5 text-base font-semibold tabular-nums tracking-tight text-neutral-900">
              {item.value}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
