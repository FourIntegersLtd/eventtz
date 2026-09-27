"use client";

/**
 * Pieces of the booking request dialog: package rows, the event banner,
 * and the display-only fee breakdown.
 */
import { Button } from "@/foundation/ui";
import { formatBookingMoneyLabel } from "./bookingServiceFee";
import type { ClientEventPrefill } from "./clientEventPrefill";
import { lineTotalGbp } from "./packagePricing";
import type { BrowsePricingOption } from "./vendorBrowseDetailModel";

export function PackageLine({
  option,
  quantity,
  onQuantity,
}: {
  option: BrowsePricingOption;
  quantity: number;
  onQuantity: (quantity: number) => void;
}) {
  const perUnit = option.pricingMode === "per_unit";
  const lineTotal = perUnit ? lineTotalGbp(option.unitPriceGbp, quantity) : option.unitPriceGbp;
  return (
    <li className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-neutral-900">{option.heading}</span>
        <div className="shrink-0 text-right">
          {lineTotal != null ? (
            <>
              {perUnit && option.priceDisplay != null ? (
                <p className="text-xs text-neutral-500">
                  {quantity} × £{option.priceDisplay}
                  {option.priceSuffix ? ` ${option.priceSuffix}` : ""}
                </p>
              ) : option.compareAtDisplay ? (
                <p className="text-xs text-neutral-500 line-through">£{option.compareAtDisplay}</p>
              ) : null}
              <p
                className={`text-sm font-semibold ${
                  option.compareAtDisplay && !perUnit ? "text-primary" : "text-neutral-900"
                }`}
              >
                {formatBookingMoneyLabel(lineTotal)}
              </p>
              {option.discountBadge ? (
                <p className="mt-0.5 text-xs font-medium text-green-700">{option.discountBadge}</p>
              ) : null}
            </>
          ) : (
            <span className="text-sm font-semibold text-neutral-900">TBC</span>
          )}
        </div>
      </div>
      {perUnit ? (
        <QuantityStepper
          value={quantity}
          min={option.minQuantity}
          max={option.maxQuantity}
          onChange={onQuantity}
          label={`Quantity for ${option.heading}`}
        />
      ) : null}
    </li>
  );
}

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
    <div
      className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        disabled={!canDecrement}
        aria-label="Decrease quantity"
        onClick={() => onChange(value <= min ? 0 : value - 1)}
        className="inline-flex h-9 w-9 items-center justify-center text-neutral-700 enabled:hover:bg-neutral-50 disabled:text-neutral-300"
      >
        −
      </button>
      <span className="min-w-[2.25rem] px-1 text-center text-sm font-semibold tabular-nums text-neutral-900">
        {value}
      </span>
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

export function ActiveEventPrefillBanner({
  prefill,
  onUse,
  onNewEvent,
}: {
  prefill: ClientEventPrefill;
  onUse: () => void;
  onNewEvent: () => void;
}) {
  const dateLabel = formatEventDateLabel(prefill.eventDate);
  return (
    <div className="relative rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 pr-12">
      <button
        type="button"
        onClick={onNewEvent}
        className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/70 hover:text-neutral-700"
        aria-label="Dismiss"
      >
        <span aria-hidden="true">×</span>
      </button>
      <p className="text-sm font-semibold text-neutral-900">Planning the same event?</p>
      <p className="mt-0.5 text-sm text-neutral-600">
        <span className="font-medium text-neutral-800">{prefill.eventName}</span>
        {dateLabel ? ` · ${dateLabel}` : null}
      </p>
      <div className="mt-3">
        <Button type="button" variant="primary" onClick={onUse}>
          Use these details
        </Button>
      </div>
    </div>
  );
}

function formatEventDateLabel(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const parsed = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Display-only fee rows. These numbers are never posted. */
export function FeeBreakdown({
  vendorPortionLabel,
  feeLabel,
  feePercent,
  totalLabel,
  feeBeforeDiscountLabel,
  referralDiscountLabel,
  referralApplied,
}: {
  vendorPortionLabel: string;
  feeLabel: string;
  feePercent: number;
  totalLabel: string;
  feeBeforeDiscountLabel: string;
  referralDiscountLabel: string | null;
  referralApplied: boolean;
}) {
  const showReferral = referralApplied && feeBeforeDiscountLabel && referralDiscountLabel;
  return (
    <div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-2 text-neutral-600">
          <span>Vendor portion</span>
          <span className="font-medium tabular-nums text-neutral-900">{vendorPortionLabel}</span>
        </div>
        {showReferral ? (
          <>
            <div className="flex justify-between gap-2 text-neutral-600">
              <span>
                Eventtz fee <span className="text-neutral-400">({feePercent}%)</span>
              </span>
              <span className="font-medium tabular-nums text-neutral-500 line-through">
                {feeBeforeDiscountLabel}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-emerald-800">
              <span>Referral discount</span>
              <span className="font-medium tabular-nums">{referralDiscountLabel}</span>
            </div>
            <div className="flex justify-between gap-2 text-neutral-600">
              <span>Eventtz fee due</span>
              <span className="font-medium tabular-nums text-neutral-900">{feeLabel}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-2 text-neutral-600">
            <span>
              Eventtz fee <span className="text-neutral-400">({feePercent}%)</span>
            </span>
            <span className="font-medium tabular-nums text-neutral-900">{feeLabel}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm">
        <span className="font-medium text-neutral-700">Estimated total</span>
        <span className="font-heading text-lg font-semibold tabular-nums text-neutral-900">{totalLabel}</span>
      </div>
      <p className="mt-2 text-xs text-neutral-500">The vendor may adjust the price before you pay.</p>
    </div>
  );
}

type BookingResult =
  | { type: "success"; bookingId: string }
  | { type: "error"; message: string };

/** Success or API-error step shown over the booking form. */
export function BookingResultDialog({
  result,
  vendorDisplayName,
  onViewBooking,
  onBack,
}: {
  result: BookingResult;
  vendorDisplayName: string;
  onViewBooking: (bookingId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-neutral-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-result-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="booking-result-title" className="text-base font-semibold text-neutral-900">
          {result.type === "success" ? "Request sent" : "Couldn't send request"}
        </h2>
        {result.type === "success" ? (
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">
            Your booking request was sent to {vendorDisplayName}. They&apos;ll respond in your bookings inbox.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-red-900">{result.message}</p>
        )}
        <div className="mt-5">
          {result.type === "success" ? (
            <Button variant="primary" className="w-full" onClick={() => onViewBooking(result.bookingId)}>
              View booking
            </Button>
          ) : (
            <Button variant="primary" className="w-full" onClick={onBack}>
              Back to form
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
