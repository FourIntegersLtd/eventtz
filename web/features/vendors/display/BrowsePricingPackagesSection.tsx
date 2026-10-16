"use client";

import type { ReactNode } from "react";
import type { BrowsePricingOption } from "@/features/client/browse/vendorBrowseDetailModel";

type BrowsePricingPackagesSectionProps = {
  options: BrowsePricingOption[];
  listClassName?: string;
  getItemClassName?: (opt: BrowsePricingOption) => string;
  /** Inside another white card (admin) — no outer section divider. */
  nested?: boolean;
  children: (opt: BrowsePricingOption) => ReactNode;
};

/** Gray inset card for package rows on the white pricing panel. */
export function BrowsePricingPackagesSection({
  options,
  listClassName = "",
  getItemClassName,
  nested = false,
  children,
}: BrowsePricingPackagesSectionProps) {
  const safeOptions = options ?? [];
  if (safeOptions.length === 0) {
    return null;
  }

  return (
    <section
      className={
        nested
          ? "px-5 pb-5 pt-4"
          : "border-t border-neutral-100 px-5 pb-5 pt-4"
      }
      aria-labelledby="vendor-pricing-packages-heading"
    >
      <h4
        id="vendor-pricing-packages-heading"
        className="mb-3 text-sm font-semibold text-neutral-900"
      >
        Packages
      </h4>
      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
        <ul className={`divide-y divide-neutral-200/60 ${listClassName}`.trim()}>
          {safeOptions.map((opt) => (
            <li key={opt.id} className={getItemClassName?.(opt) ?? "px-4 py-4"}>
              {children(opt)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
