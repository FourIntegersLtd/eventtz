"use client";

/**
 * Fields and the send button inside the booking request dialog.
 * The fee rows are display only; they are not part of the request.
 */
import type { RefObject } from "react";
import { Button } from "@/foundation/ui";
import { formatBookingMoneyLabel, type ClientFeeBreakdown } from "./bookingServiceFee";
import { CLIENT_BOOKING_NOTES_MAX_LENGTH } from "./bookingRequestValidation";
import type { ClientEventPrefill } from "./clientEventPrefill";
import type { BrowsePricingOption } from "./vendorBrowseDetailModel";
import {
  ActiveEventPrefillBanner,
  FeeBreakdown,
  PackageLine,
} from "./VendorBookingModalParts";

type VendorBookingFormProps = {
  submit: () => void;
  closeForm: () => void;
  calendarConflict: boolean;
  bannerVisible: boolean;
  pendingPrefill: ClientEventPrefill | null;
  applyBannerPrefill: () => void;
  setValidationError: (message: string | null) => void;
  dismissForNewEvent: () => void;
  eventNameRef: RefObject<HTMLInputElement | null>;
  eventName: string;
  setEventName: (value: string) => void;
  minEventDate: string;
  eventDate: string;
  setEventDate: (value: string) => void;
  eventEndDate: string;
  setEventEndDate: (value: string) => void;
  venueAddress: string;
  setVenueAddress: (value: string) => void;
  selectedOptions: BrowsePricingOption[];
  quantities: Record<string, number>;
  setPackageQuantity: (id: string, quantity: number) => void;
  estimate: { label: string; autoLines: { id: string; heading: string; unitPriceGbp: number | null }[] };
  notes: string;
  setNotes: (value: string) => void;
  referralFieldsOpen: boolean;
  openReferral: () => void;
  referralInputRef: RefObject<HTMLInputElement | null>;
  referralCode: string;
  setReferralCode: (value: string) => void;
  onReferralCodeBlur: () => void;
  referralValidating: boolean;
  referralApplied: boolean;
  clientFeeBreakdown: ClientFeeBreakdown | null;
  referralError: string | null;
  validationError: string | null;
  submitting: boolean;
};

/** Event, packages, notes, referral code, and the send button. */
export function VendorBookingForm({
  eventNameRef,
  referralInputRef,
  ...fields
}: VendorBookingFormProps) {
  return (
<form
  onSubmit={(event) => {
    event.preventDefault();
    fields.submit();
  }}
>
  <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
    {fields.calendarConflict ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        These dates may not work for this vendor. Pick new dates or message them.
      </div>
    ) : null}
    {fields.bannerVisible && fields.pendingPrefill ? (
      <ActiveEventPrefillBanner
        prefill={fields.pendingPrefill}
        onUse={() => {
          fields.applyBannerPrefill();
          fields.setValidationError(null);
        }}
        onNewEvent={fields.dismissForNewEvent}
      />
    ) : null}

    <div>
      <label
        htmlFor="booking-event-name"
        className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
      >
        Event name
      </label>
      <input
        ref={eventNameRef}
        id="booking-event-name"
        type="text"
        value={fields.eventName}
        maxLength={500}
        onChange={(event) => {
          fields.setEventName(event.target.value);
          fields.setValidationError(null);
        }}
        placeholder="e.g. Ade and Kemi - wedding reception"
        className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
      />
    </div>

    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="min-w-0">
        <label
          htmlFor="booking-event-date"
          className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Event date
        </label>
        <input
          id="booking-event-date"
          type="date"
          min={fields.minEventDate}
          value={fields.eventDate}
          onChange={(event) => {
            fields.setEventDate(event.target.value);
            fields.setValidationError(null);
          }}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
        />
      </div>
      <div className="min-w-0">
        <label
          htmlFor="booking-event-end"
          className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          End date <span className="font-normal normal-case text-neutral-400">(optional)</span>
        </label>
        <input
          id="booking-event-end"
          type="date"
          min={fields.eventDate.trim() || fields.minEventDate}
          value={fields.eventEndDate}
          onChange={(event) => {
            fields.setEventEndDate(event.target.value);
            fields.setValidationError(null);
          }}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
        />
      </div>
    </div>

    <div>
      <label
        htmlFor="booking-venue-address"
        className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
      >
        Venue location <span className="font-normal normal-case text-neutral-400">(optional)</span>
      </label>
      <textarea
        id="booking-venue-address"
        rows={3}
        maxLength={500}
        value={fields.venueAddress}
        onChange={(event) => {
          fields.setVenueAddress(event.target.value);
          fields.setValidationError(null);
        }}
        placeholder="e.g. The Grand Hall, 12 Park Lane, London"
        className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
      />
      <p className="mt-1 text-xs text-neutral-500">Add before you pay.</p>
    </div>

    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Packages &amp; rates
        </p>
        <button
          type="button"
          onClick={fields.closeForm}
          className="text-xs font-medium text-primary hover:underline"
        >
          Change
        </button>
      </div>
      <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {fields.selectedOptions.map((option) => (
          <PackageLine
            key={option.id}
            option={option}
            quantity={fields.quantities[option.id] ?? option.minQuantity}
            onQuantity={(next) => fields.setPackageQuantity(option.id, next)}
          />
        ))}
        {fields.estimate.autoLines.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-baseline justify-between gap-2 bg-emerald-50/60 px-3 py-2.5"
          >
            <span className="text-sm font-medium text-emerald-900">{line.heading}</span>
            <span className="shrink-0 text-sm font-semibold text-emerald-800">
              {line.unitPriceGbp != null
                ? formatBookingMoneyLabel(Math.abs(line.unitPriceGbp))
                : "TBC"}
            </span>
          </li>
        ))}
      </ul>
    </div>

    <div>
      <label
        htmlFor="booking-notes"
        className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
      >
        Details for the vendor
      </label>
      <textarea
        id="booking-notes"
        value={fields.notes}
        onChange={(event) => fields.setNotes(event.target.value)}
        rows={4}
        maxLength={CLIENT_BOOKING_NOTES_MAX_LENGTH}
        placeholder="Guest count, venue, dietary needs, timeline, or questions…"
        className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
      />
      <p className="mt-1 text-right text-xs text-neutral-400">
        {fields.notes.length}/{CLIENT_BOOKING_NOTES_MAX_LENGTH}
      </p>
    </div>

    {fields.referralFieldsOpen ? (
      <div>
        <label
          htmlFor="booking-referral-code"
          className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
        >
          Referral code{" "}
          <span className="font-normal normal-case text-neutral-400">(optional)</span>
        </label>
        <input
          ref={referralInputRef}
          id="booking-referral-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={fields.referralCode}
          onChange={(event) => fields.setReferralCode(event.target.value)}
          onBlur={fields.onReferralCodeBlur}
          autoComplete="off"
          placeholder="Up to 6 digits from the vendor"
          className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
        />
        {fields.referralValidating ? (
          <p className="mt-1 text-xs text-neutral-500">Checking code…</p>
        ) : fields.referralApplied && fields.clientFeeBreakdown?.referralDiscountLabel ? (
          <p className="mt-1 text-xs font-medium text-emerald-700">
            Referral discount applied —{" "}
            {fields.clientFeeBreakdown.referralDiscountLabel.replace(/^-/, "")} off your Eventtz fee
          </p>
        ) : fields.referralError ? (
          <p className="mt-1 text-xs text-red-700">{fields.referralError}</p>
        ) : null}
      </div>
    ) : (
      <button
        type="button"
          onClick={fields.openReferral}
        className="text-xs text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
      >
        Referral code?
      </button>
    )}

    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      {fields.clientFeeBreakdown ? (
        <FeeBreakdown
          vendorPortionLabel={fields.clientFeeBreakdown.vendorPortionLabel}
          feeLabel={fields.clientFeeBreakdown.feeLabel}
          feePercent={fields.clientFeeBreakdown.feePercent}
          totalLabel={fields.clientFeeBreakdown.totalLabel}
          feeBeforeDiscountLabel={fields.clientFeeBreakdown.feeBeforeDiscountLabel}
          referralDiscountLabel={fields.clientFeeBreakdown.referralDiscountLabel}
          referralApplied={fields.clientFeeBreakdown.referralApplied}
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">Estimated total</span>
            <span className="font-heading text-lg font-semibold text-neutral-900">
              {fields.estimate.label.replace(/^GBP\s/, "£")}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            The vendor may adjust the price before you pay.
          </p>
        </>
      )}
    </div>

    {fields.validationError ? (
      <p className="text-sm text-red-700" role="alert">
        {fields.validationError}
      </p>
    ) : null}
  </div>

  <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
    <Button type="submit" variant="primary" loading={fields.submitting} className="w-full py-3">
      {fields.submitting ? "Sending…" : "Send booking request"}
    </Button>
  </div>
</form>
  );
}
