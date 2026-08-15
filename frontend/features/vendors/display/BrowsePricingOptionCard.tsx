"use client";

import { ChevronDown, CircleHelp, Clock, Truck } from "lucide-react";
import type { BrowsePricingOption } from "@/features/client/browse/vendorBrowseDetailModel";

export type BrowsePricingOptionCardProps = {
  opt: BrowsePricingOption;
  packageTravelLine?: string | null;
  hideFeatureLines?: boolean;
  hidePromoLines?: boolean;
  showCheckbox?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  detailsMode?: "collapsible" | "always";
  isOpen?: boolean;
  onToggleDetails?: () => void;
};

function PricingOptionDetails({ description }: { description: string }) {
  if (!description) return null;

  return (
    <p className="text-[13px] leading-relaxed text-neutral-600">{description}</p>
  );
}

export function BrowsePricingOptionCard({
  opt,
  packageTravelLine = null,
  hideFeatureLines = false,
  hidePromoLines = false,
  showCheckbox = false,
  selected = false,
  onToggleSelect,
  detailsMode = "collapsible",
  isOpen = false,
  onToggleDetails,
}: BrowsePricingOptionCardProps) {
  const description = opt.description?.trim() ?? "";
  const showFeatureLines = !hideFeatureLines && opt.featureLines.length > 0;
  const hasPackageDetails = Boolean(description) || showFeatureLines;
  const showPromoLines = !hidePromoLines && opt.promoLines.length > 0;
  const detailsExpanded = detailsMode === "always" || isOpen;

  return (
    <div className="flex gap-3">
      {showCheckbox ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-primary focus:ring-primary/30"
          aria-label={`Include ${opt.heading}`}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-neutral-900">{opt.heading}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
            {opt.priceDisplay != null ? (
              <>
                {opt.compareAtDisplay ? (
                  <span className="mr-1.5 text-xs font-normal text-neutral-400 line-through">
                    £{opt.compareAtDisplay}
                  </span>
                ) : null}
                £{opt.priceDisplay}
              </>
            ) : (
              <span className="font-medium text-neutral-500">Quote</span>
            )}
          </p>
        </div>

        {opt.discountBadge ? (
          <p>
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
              {opt.discountBadge}
            </span>
          </p>
        ) : null}

        {opt.timelineLine ? (
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
            {opt.timelineLine}
          </p>
        ) : null}

        {packageTravelLine ? (
          <p className="flex items-start gap-1.5 text-xs leading-snug text-neutral-600">
            <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
            {packageTravelLine}
          </p>
        ) : null}

        {showPromoLines ? (
          <ul className="space-y-1 text-xs text-neutral-600">
            {opt.promoLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {hasPackageDetails ? (
          <div className="mt-2">
            {detailsMode === "collapsible" ? (
              <>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDetails?.();
                  }}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary underline decoration-primary/50 underline-offset-[3px] transition hover:decoration-primary"
                >
                  <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  What&apos;s included?
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 opacity-80 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                </button>
                {detailsExpanded ? (
                  <div className="mt-2.5 space-y-2">
                    <PricingOptionDetails description={description} />
                    {showFeatureLines ? (
                      <ul className="space-y-1 text-[13px] text-neutral-600">
                        {opt.featureLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary underline decoration-primary/50 underline-offset-[3px]">
                  <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  What&apos;s included?
                </p>
                <div className="mt-2.5">
                  <PricingOptionDetails description={description} />
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
