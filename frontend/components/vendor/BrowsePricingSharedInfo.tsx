"use client";

import type { BrowsePricingSharedContext } from "@/features/client/browse/vendorBrowseDetailModel";

type BrowsePricingSharedInfoProps = BrowsePricingSharedContext & {
  className?: string;
  /** Inside another card (admin review) — skip outer section divider. */
  embedded?: boolean;
  /**
   * Browse sidebar: only promos (services/travel live on the profile card).
   * Admin/full: show travel, services, and discounts.
   */
  variant?: "booking" | "full";
};

/** Vendor-level logistics, services, and promos — collected once in onboarding, not per package. */
export function BrowsePricingSharedInfo({
  travelLine,
  serviceLines,
  promoLines,
  className = "",
  embedded = false,
  variant = "full",
}: BrowsePricingSharedInfoProps) {
  const showTravel = variant === "full" && Boolean(travelLine);
  const showServices = variant === "full" && serviceLines.length > 0;
  const showPromos = promoLines.length > 0;

  if (!showTravel && !showServices && !showPromos) {
    return null;
  }

  return (
    <div
      className={
        embedded
          ? `space-y-4 px-5 py-5 ${className}`.trim()
          : `space-y-4 border-t border-neutral-100 px-5 py-5 ${className}`.trim()
      }
    >
      {showTravel ? (
        <div>
          <p className="text-[13px] text-neutral-500">Travel &amp; delivery</p>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">{travelLine}</p>
        </div>
      ) : null}

      {showServices ? (
        <div>
          <p className="text-[13px] text-neutral-500">Services covered</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {serviceLines.map((line) => (
              <li
                key={line}
                className="inline-flex rounded-full border border-neutral-100 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-800"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showPromos ? (
        <div>
          <p className="text-[13px] text-neutral-500">Extra savings</p>
          <ul className="mt-1.5 space-y-1">
            {promoLines.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-neutral-700">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
