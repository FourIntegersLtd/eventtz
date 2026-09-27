"use client";

/**
 * Pricing sidebar: packages, the fee estimate, and the booking or sign-in actions.
 * The fee is computed for display. Nothing here sends a price.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/foundation/ui";
import { computeClientFeeBreakdown } from "./bookingServiceFee";
import { PricingOption } from "./VendorProfilePricingOption";
import {
  extractBrowsePricingSharedContext,
  formatBookingTotalGbp,
  packageSpecificTravelLine,
  type BookingLineItem,
  type BrowsePricingOption,
} from "./vendorBrowseDetailModel";

type VendorProfilePricingProps = {
  payload: Record<string, unknown>;
  options: BrowsePricingOption[];
  selectedIds: Set<string>;
  quantities: Record<string, number>;
  lineItems: BookingLineItem[];
  referralDiscountGbp: number;
  onTogglePackage: (id: string) => void;
  onPackageQuantity: (id: string, quantity: number) => void;
  showBookingActions: boolean;
  requireLogin: boolean;
  registerHref: string;
  loginHref: string;
  messageHref: string;
  continueHref: string;
  bookingSelectError: boolean;
  onRequestBooking: () => void;
};

/** Package list and the actions under it. */
export function VendorProfilePricing({
  payload,
  options,
  selectedIds,
  quantities,
  lineItems,
  referralDiscountGbp,
  onTogglePackage,
  onPackageQuantity,
  showBookingActions,
  requireLogin,
  registerHref,
  loginHref,
  messageHref,
  continueHref,
  bookingSelectError,
  onRequestBooking,
}: VendorProfilePricingProps) {
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null);
  const shared = useMemo(() => extractBrowsePricingSharedContext(payload, options), [payload, options]);
  const selectedTotal = useMemo(() => formatBookingTotalGbp(lineItems), [lineItems]);
  const fee = useMemo(() => {
    if (selectedTotal.hasTbc) return null;
    return computeClientFeeBreakdown({
      vendorPortionGbp: selectedTotal.sumNumeric,
      referralFeeDiscountGbp: referralDiscountGbp,
    });
  }, [selectedTotal.hasTbc, selectedTotal.sumNumeric, referralDiscountGbp]);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      {shared.promoLines.length > 0 ? (
        <div className="space-y-1 px-5 pb-1 pt-5">
          <p className="text-[13px] text-neutral-500">Extra savings</p>
          <ul className="space-y-1">
            {shared.promoLines.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-neutral-700">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="px-5 pb-5 pt-4" aria-labelledby="vendor-pricing-packages-heading">
        <h4 id="vendor-pricing-packages-heading" className="mb-3 text-sm font-semibold text-neutral-900">
          Packages
        </h4>
        <ul className="max-h-[min(60vh,500px)] divide-y divide-neutral-200/60 overflow-y-auto overscroll-contain rounded-xl border border-neutral-100 bg-neutral-50">
          {options.map((option) => (
            <li key={option.id} className="px-4 py-4">
              <PricingOption
                option={option}
                travelLine={packageSpecificTravelLine(option, shared)}
                hideFeatureLines={shared.serviceLines.length > 0}
                hidePromoLines={shared.promoLines.length > 0}
                showCheckbox={showBookingActions}
                selected={selectedIds.has(option.id)}
                quantity={quantities[option.id] ?? 0}
                detailsOpen={detailOpenId === option.id}
                onToggleSelect={() => onTogglePackage(option.id)}
                onQuantityChange={
                  showBookingActions && option.pricingMode === "per_unit"
                    ? (quantity) => onPackageQuantity(option.id, quantity)
                    : undefined
                }
                onToggleDetails={() => setDetailOpenId(detailOpenId === option.id ? null : option.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {showBookingActions && selectedIds.size > 0 ? (
        <div className="border-t border-neutral-100 px-5 py-4">
          {fee ? <FeeSummary breakdown={fee} /> : (
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] text-neutral-500">Estimated total</p>
              <p className="text-base font-semibold tabular-nums text-neutral-900">
                {selectedTotal.label.replace(/^GBP\s/, "£")}
              </p>
            </div>
          )}
          {selectedTotal.hasTbc ? (
            <p className="mt-1 text-[12px] text-neutral-400">Includes items that need a custom quote.</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
        {requireLogin ? (
          <>
            <p className="text-[13px] leading-snug text-neutral-500">Create a free client account to continue.</p>
            <Link
              href={registerHref}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Create account
            </Link>
            <p className="text-center text-xs text-neutral-500">
              Already have an account?{" "}
              <Link href={loginHref} className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </>
        ) : showBookingActions ? (
          <div className="space-y-2.5">
            {bookingSelectError ? (
              <p className="text-[13px] text-amber-800">Select at least one package or rate to continue.</p>
            ) : null}
            <Button type="button" className="w-full" onClick={onRequestBooking}>
              Request booking
            </Button>
            <Link
              href={messageHref}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary-muted"
            >
              Message vendor
            </Link>
          </div>
        ) : (
          <Link
            href={continueHref}
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Contact me
          </Link>
        )}
      </div>
    </div>
  );
}

/** Vendor portion, Eventtz fee, and estimated total. Referral rows appear only when a discount applies. */
function FeeSummary({
  breakdown,
}: {
  breakdown: NonNullable<ReturnType<typeof computeClientFeeBreakdown>>;
}) {
  return (
    <div>
      <div className="space-y-2 text-[13px]">
        <div className="flex justify-between gap-2 text-neutral-600">
          <span>Vendor portion</span>
          <span className="font-medium tabular-nums text-neutral-900">{breakdown.vendorPortionLabel}</span>
        </div>
        {breakdown.referralApplied && breakdown.referralDiscountLabel ? (
          <>
            <div className="flex justify-between gap-2 text-neutral-600">
              <span>
                Eventtz fee <span className="text-neutral-400">({breakdown.feePercent}%)</span>
              </span>
              <span className="font-medium tabular-nums text-neutral-500 line-through">
                {breakdown.feeBeforeDiscountLabel}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-emerald-800">
              <span>Referral discount</span>
              <span className="font-medium tabular-nums">{breakdown.referralDiscountLabel}</span>
            </div>
            <div className="flex justify-between gap-2 text-neutral-600">
              <span>Eventtz fee due</span>
              <span className="font-medium tabular-nums text-neutral-900">{breakdown.feeLabel}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-2 text-neutral-600">
            <span>
              Eventtz fee <span className="text-neutral-400">({breakdown.feePercent}%)</span>
            </span>
            <span className="font-medium tabular-nums text-neutral-900">{breakdown.feeLabel}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm">
        <span className="font-medium text-neutral-700">Estimated total</span>
        <span className="text-base font-semibold tabular-nums text-neutral-900">{breakdown.totalLabel}</span>
      </div>
    </div>
  );
}
