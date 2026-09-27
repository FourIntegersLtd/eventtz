"use client";

import { Button } from "@/foundation/ui";
import type { ClientBookingDetail } from "@/domains/client-bookings/api";
import { formatAdjustmentAmount, resolveWasClientTotalLabel } from "@/domains/client-bookings/priceLabels";

/**
 * "New price from your vendor": the old and new totals, each adjustment the
 * vendor made, and the fee split, with accept/decline. Ported from the
 * baseline's `BookingPriceUpdateBanner`. Declining only opens a confirmation.
 */
export function PriceUpdateBanner({
  booking,
  busy,
  accepting,
  onAccept,
  onDecline,
}: {
  booking: ClientBookingDetail;
  busy: boolean;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const pricing = booking.pricing;
  const adjustments = pricing?.vendor_adjustments ?? [];
  const nowTotalLabel = pricing?.client_total_label ?? booking.total_label;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-amber-50/40 ring-1 ring-amber-200/80">
      <div className="px-4 py-3">
        <p className="font-semibold text-neutral-900">New price from your vendor</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="text-neutral-500">
            Was: <span className="font-medium text-neutral-600 line-through">{resolveWasClientTotalLabel(booking)}</span>
          </span>
          <span className="font-semibold text-neutral-400" aria-hidden="true">
            →
          </span>
          <span className="font-semibold text-neutral-900">Now: {nowTotalLabel}</span>
        </p>

        {adjustments.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
            {adjustments.map((adjustment) => (
              <li key={adjustment.id}>
                {adjustment.label}: {formatAdjustmentAmount(adjustment.amount_gbp)}
              </li>
            ))}
          </ul>
        ) : null}

        {pricing && !pricing.has_pricing_tbc ? (
          <dl className="mt-3 space-y-1 rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-neutral-200/80">
            <div className="flex justify-between">
              <dt className="text-neutral-600">Vendor portion</dt>
              <dd className="text-neutral-900">{pricing.vendor_portion_label}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600">Eventtz fee ({pricing.service_fee_percent}%)</dt>
              <dd className="text-neutral-900">{pricing.service_fee_label}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt className="text-neutral-900">Total due</dt>
              <dd className="text-neutral-900">{pricing.client_total_label}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-100 px-4 py-3 sm:flex-row sm:justify-end">
        <Button disabled={busy} loading={accepting} onClick={onAccept}>
          Accept new price
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onDecline}>
          Decline
        </Button>
      </div>
    </div>
  );
}
