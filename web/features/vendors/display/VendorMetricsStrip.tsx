"use client";

import { CalendarCheck, Clock, Percent, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";
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
  className?: string;
};

/**
 * Reusable public vendor stats (rating, completed events, reply time, conversion).
 * Plug into browse detail, marketplace cards, or admin previews.
 */
export function VendorMetricsStrip({
  metrics,
  includeRating = true,
  className = "",
}: VendorMetricsStripProps) {
  const items = buildVendorMetricItems(metrics, { includeRating });
  if (items.length === 0) return null;

  return (
    <ul
      className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`.trim()}
      aria-label="Vendor stats"
    >
      {items.map((item) => {
        const Icon = ICONS[item.key];
        return (
          <li key={item.key}>
            <StatTile compact icon={Icon} label={item.label} value={item.value} />
          </li>
        );
      })}
    </ul>
  );
}
