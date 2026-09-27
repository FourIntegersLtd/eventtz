"use client";

/**
 * One package row in the profile pricing sidebar, including the per-unit stepper.
 */
import { lineTotalGbp } from "./packagePricing";
import type { BrowsePricingOption } from "./vendorBrowseDetailModel";

/** A selectable package or rate, with optional quantity and "what's included". */
export function PricingOption({
  option,
  travelLine,
  hideFeatureLines,
  hidePromoLines,
  showCheckbox,
  selected,
  quantity,
  detailsOpen,
  onToggleSelect,
  onQuantityChange,
  onToggleDetails,
}: {
  option: BrowsePricingOption;
  travelLine: string | null;
  hideFeatureLines: boolean;
  hidePromoLines: boolean;
  showCheckbox: boolean;
  selected: boolean;
  quantity: number;
  detailsOpen: boolean;
  onToggleSelect: () => void;
  onQuantityChange?: (quantity: number) => void;
  onToggleDetails: () => void;
}) {
  const perUnit = option.pricingMode === "per_unit";
  const showStepper = perUnit && Boolean(onQuantityChange);
  const lineTotal = showStepper ? lineTotalGbp(option.unitPriceGbp, quantity) : null;
  const showFeatures = !hideFeatureLines && option.featureLines.length > 0;

  return (
    <div className="flex gap-3">
      {showCheckbox && !showStepper ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-primary"
          aria-label={`Include ${option.heading}`}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-neutral-900">{option.heading}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
            {option.priceDisplay != null ? (
              <>
                {option.compareAtDisplay ? (
                  <span className="mr-1.5 text-xs font-normal text-neutral-400 line-through">
                    £{option.compareAtDisplay}
                    {option.priceSuffix ? ` ${option.priceSuffix}` : ""}
                  </span>
                ) : null}
                £{option.priceDisplay}
                {option.priceSuffix ? (
                  <span className="ml-1 text-xs font-medium text-neutral-500">{option.priceSuffix}</span>
                ) : null}
              </>
            ) : (
              <span className="font-medium text-neutral-500">Quote</span>
            )}
          </p>
        </div>
        {showStepper && onQuantityChange ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <QuantityStepper
              value={quantity}
              min={option.minQuantity}
              max={option.maxQuantity}
              onChange={onQuantityChange}
              label={`Quantity for ${option.heading}`}
            />
            {quantity > 0 && lineTotal != null ? (
              <p className="text-xs tabular-nums text-neutral-600">
                {quantity} × £{option.priceDisplay} = £
                {lineTotal.toLocaleString("en-GB", {
                  minimumFractionDigits: lineTotal % 1 === 0 ? 0 : 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            ) : (
              <p className="text-xs text-neutral-400">
                {option.minQuantity > 1 ? `Min ${option.minQuantity}` : "Choose a quantity"}
              </p>
            )}
          </div>
        ) : null}
        {option.discountBadge ? (
          <p>
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
              {option.discountBadge}
            </span>
          </p>
        ) : null}
        {option.timelineLine ? <p className="text-xs text-neutral-500">{option.timelineLine}</p> : null}
        {travelLine ? <p className="text-xs leading-snug text-neutral-600">{travelLine}</p> : null}
        {!hidePromoLines && option.promoLines.length > 0 ? (
          <ul className="space-y-1 text-xs text-neutral-600">
            {option.promoLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {option.description || showFeatures ? (
          <div>
            <button
              type="button"
              aria-expanded={detailsOpen}
              onClick={onToggleDetails}
              className="text-[13px] font-medium text-primary underline decoration-primary/50 underline-offset-[3px]"
            >
              What&apos;s included?
            </button>
            {detailsOpen ? (
              <div className="mt-2.5 space-y-2">
                {option.description ? (
                  <p className="text-[13px] leading-relaxed text-neutral-600">{option.description}</p>
                ) : null}
                {showFeatures ? (
                  <ul className="space-y-1 text-[13px] text-neutral-600">
                    {option.featureLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Plus jumps from 0 to the package minimum. Minus from the minimum returns to 0. */
function QuantityStepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number | null;
  onChange: (quantity: number) => void;
  label: string;
}) {
  const canDecrement = value > 0;
  const canIncrement = value <= 0 || max == null || value < max;
  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white" role="group" aria-label={label}>
      <button
        type="button"
        disabled={!canDecrement}
        aria-label="Decrease quantity"
        onClick={() => onChange(value <= min ? 0 : value - 1)}
        className="inline-flex h-9 w-9 items-center justify-center text-neutral-700 enabled:hover:bg-neutral-50 disabled:text-neutral-300"
      >
        −
      </button>
      <span className="min-w-[2.25rem] px-1 text-center text-sm font-semibold tabular-nums text-neutral-900">{value}</span>
      <button
        type="button"
        disabled={!canIncrement}
        aria-label="Increase quantity"
        onClick={() => {
          if (value <= 0) onChange(min);
          else if (max == null || value < max) onChange(value + 1);
        }}
        className="inline-flex h-9 w-9 items-center justify-center text-neutral-700 enabled:hover:bg-neutral-50 disabled:text-neutral-300"
      >
        +
      </button>
    </div>
  );
}
