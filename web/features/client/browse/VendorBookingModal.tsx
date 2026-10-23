"use client";

import { Banner } from "@/components/ui/Banner";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, Pencil, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { Card } from "@/components/ui/Card";
import { DateInput } from "@/components/ui/DateInput";
import {
  explainVendorDateConflict,
  isoDatesInEventRange,
  vendorBlockedDatesSentence,
  vendorWorkingDaysSentence,
} from "@/lib/vendorAvailability";
import {
  computeBookingEstimateGbp,
  formatBookingEstimateLabel,
} from "@/lib/vendorDiscountDisplay";
import { computeClientFeeBreakdown } from "@/lib/bookingServiceFee";
import { ClientFeeBreakdownSummary } from "@/features/bookings/ClientFeeBreakdownSummary";
import { todayIsoDate } from "@/lib/eventDateValidation";
import {
  type BrowsePricingOption,
  bookingQuantitiesPayload,
} from "../../../lib/vendorBrowseDetailModel";
import { usePerUnitPackageSelection } from "./usePerUnitPackageSelection";

/** Uppercase caption above each field in the request form. */
const FIELD_LABEL_CLASS = "block text-xs font-semibold uppercase tracking-wide text-ink-3";

/** Shared look of the plain text inputs and textareas in the request form. */
const FIELD_INPUT_CLASS =
  "mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-base text-ink placeholder:text-ink-3/65 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { lineTotalGbp } from "@/lib/packagePricing";
import { depositFromPayload, depositSummaryLine } from "@/features/bookings/bookingTerms";
import { useVendorBookingSubmit } from "@/features/client/browse/useVendorBookingSubmit";
import { useVendorReferralPreview } from "@/features/client/browse/useVendorReferralPreview";
import type { ClientSearchContext } from "@/lib/clientBookingsApi";
import { ActiveEventPrefillBanner } from "@/features/bookings/ActiveEventPrefillBanner";
import type { EventEnquirePrefill } from "@/features/bookings/eventEnquirePrefill";
import { useEnquireEventFormState } from "@/features/bookings/useEnquireEventFormState";
import type { MarketplaceBookingSearchPrefill } from "@/lib/marketplaceSearchParams";
import { CLIENT_BOOKING_NOTES_MAX_LENGTH } from "@/lib/validation/bookings";
import { formatGbp } from "@/lib/money";

export type VendorBookingSearchPrefill = MarketplaceBookingSearchPrefill;

type VendorBookingModalProps = {
  onClose: () => void;
  /** Called once the request is created - the caller owns navigation to the new booking's detail page. */
  onSuccess?: (bookingId: string) => void;
  vendorDisplayName: string;
  vendorUserId: string;
  pricingOptions: BrowsePricingOption[];
  /** Package / rate ids selected on the profile sidebar. */
  initialSelectedIds: string[];
  /** Per-item counts from the profile sidebar. */
  initialQuantities?: Record<string, number>;
  /** Vendor onboarding payload - used to warn if chosen dates conflict with calendar. */
  vendorPayload?: Record<string, unknown>;
  /** Dates/types from marketplace URL on `/client/browse/[id]?…`. */
  searchPrefill?: VendorBookingSearchPrefill;
  /** Event fields from AI planner (or other deep links) - applied when no active client event. */
  initialPrefill?: EventEnquirePrefill | null;
  linkedEventId?: string | null;
  /** Marketplace filters to store on the booking for alternative-vendor nudges. */
  clientSearchContext?: ClientSearchContext | null;
  /** Pre-filled from ?vref= on the browse URL. */
  initialReferralCode?: string | null;
};

export function VendorBookingModal({
  onClose,
  onSuccess,
  vendorDisplayName,
  vendorUserId,
  pricingOptions,
  initialSelectedIds,
  initialQuantities = {},
  vendorPayload,
  searchPrefill,
  initialPrefill,
  linkedEventId,
  clientSearchContext,
  initialReferralCode,
}: VendorBookingModalProps) {
  const {
    selectedIds,
    quantities,
    setPackageQuantity,
    lineItems,
  } = usePerUnitPackageSelection({
    pricingOptions,
    initialSelectedIds,
    initialQuantities,
  });
  const {
    eventName,
    setEventName,
    eventDate,
    setEventDate,
    eventEndDate,
    setEventEndDate,
    venueAddress,
    setVenueAddress,
    notes,
    setNotes,
    pendingPrefill,
    bannerVisible,
    dismissForNewEvent,
    applyBannerPrefill,
    selectedEventId,
  } = useEnquireEventFormState({
    searchPrefill,
    initialPrefill,
    linkedEventId,
  });
  const [referralFieldsOpen, setReferralFieldsOpen] = useState(
    () => Boolean(initialReferralCode?.trim()),
  );
  const referralInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialReferralCode?.trim()) {
      setReferralFieldsOpen(true);
    }
  }, [initialReferralCode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const minEventDate = todayIsoDate();

  const chosenDates = useMemo(() => {
    if (!eventDate.trim()) return [];
    return isoDatesInEventRange(eventDate.trim(), eventEndDate.trim() || null);
  }, [eventDate, eventEndDate]);

  const workingDaysSentence = vendorPayload ? vendorWorkingDaysSentence(vendorPayload) : null;
  const blockedDatesSentence = vendorPayload
    ? vendorBlockedDatesSentence(vendorPayload, minEventDate)
    : null;
  const dateConflictMessage =
    vendorPayload && chosenDates.length > 0
      ? explainVendorDateConflict(vendorPayload, chosenDates)
      : null;

  const estimate = useMemo(() => {
    const positiveLines = lineItems.map((li) => ({
      id: li.id,
      heading: li.heading,
      unitPriceGbp: li.unitPriceGbp,
    }));
    if (!vendorPayload) {
      const hasTbc = positiveLines.some((l) => l.unitPriceGbp == null);
      const sum = positiveLines.reduce((acc, l) => acc + (l.unitPriceGbp ?? 0), 0);
      return {
        label: formatBookingEstimateLabel(sum, hasTbc),
        sumNumeric: sum,
        hasTbc,
        autoLines: [] as { id: string; heading: string; unitPriceGbp: number | null }[],
      };
    }
    const result = computeBookingEstimateGbp(
      positiveLines,
      vendorPayload,
      eventDate.trim() || null,
    );
    return {
      label: formatBookingEstimateLabel(result.sumNumeric, result.hasTbc),
      sumNumeric: result.sumNumeric,
      hasTbc: result.hasTbc,
      autoLines: result.autoLines,
    };
  }, [lineItems, vendorPayload, eventDate]);

  const {
    referralCode,
    setReferralCode,
    onReferralCodeBlur,
    referralDiscountGbp,
    validating: referralValidating,
    error: referralError,
    referralApplied,
    normalizedCode: normalizedReferralCode,
  } = useVendorReferralPreview({
    vendorUserId,
    vendorPortionGbp: estimate.sumNumeric,
    initialCode: initialReferralCode,
  });

  const {
    validationError,
    setValidationError,
    submitting,
    submitResult,
    dismissResultModal,
    submit: submitBooking,
  } = useVendorBookingSubmit({
    vendorUserId,
    selectedEventId,
    clientSearchContext,
    dateConflictMessage,
  });

  const clientFeeBreakdown = useMemo(() => {
    if (estimate.hasTbc) return null;
    return computeClientFeeBreakdown({
      vendorPortionGbp: estimate.sumNumeric,
      referralFeeDiscountGbp: referralDiscountGbp,
    });
  }, [estimate.sumNumeric, estimate.hasTbc, referralDiscountGbp]);

  const submit = () => {
    submitBooking({
      eventName,
      eventDate,
      eventEndDate,
      venueAddress,
      notes,
      selectedOptionIds: [...selectedIds],
      quantities: bookingQuantitiesPayload(
        [...selectedIds],
        pricingOptions,
        quantities,
      ),
      vendorReferralCode: normalizedReferralCode,
    });
  };

  const closeUnlessResult = () => {
    if (submitResult) return;
    onClose();
  };
  const depositLine = depositSummaryLine(depositFromPayload(vendorPayload));
  const selectedOptions = pricingOptions.filter((opt) => selectedIds.has(opt.id));

  return (
    <>
      <Modal
        isOpen={submitResult !== null}
        onClose={dismissResultModal}
        zIndexClassName="z-[60]"
        maxWidthClassName="max-w-md"
        title={submitResult?.type === "success" ? "Request sent" : "Couldn't send request"}
        footer={
          submitResult?.type === "success" ? (
            <Button
              variant="primary"
              onClick={() => {
                const id = submitResult.bookingId;
                dismissResultModal();
                onSuccess?.(id);
              }}
              className="w-full"
            >
              View booking
            </Button>
          ) : (
            <Button variant="primary" onClick={dismissResultModal} className="w-full">
              Back to form
            </Button>
          )
        }
      >
        {submitResult?.type === "success" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <LottieIllustration asset="launchingSoon" size="status" ariaLabel="" />
            <p className="text-sm leading-relaxed text-ink-2">
              Your booking request was sent to {vendorDisplayName}. They&apos;ll respond in your
              bookings inbox.
            </p>
          </div>
        ) : submitResult?.type === "error" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <LottieIllustration asset="failure" size="status" ariaLabel="" />
            <p className="text-sm leading-relaxed text-danger">{submitResult.message}</p>
          </div>
        ) : null}
      </Modal>
      <Modal
        isOpen
        onClose={closeUnlessResult}
        title="Request a booking"
        maxWidthClassName="max-w-lg"
        panelClassName="relative rounded-card border border-line bg-surface shadow-overlay"
        positionClassName="items-start justify-center p-4 pt-6 sm:pt-10"
        bodyMaxHeightClassName="max-h-[min(70vh,560px)]"
        bodyPaddingClassName="space-y-4 px-5 py-4 sm:px-6"
        footerClassName="border-t border-line px-5 py-4 sm:px-6"
        header={
          <>
            <button
              type="button"
              onClick={closeUnlessResult}
              className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-line px-5 pb-4 pt-5 pr-14 sm:px-6 sm:pr-16">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarRange className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h2 id="booking-modal-title" className="mt-3 font-heading text-lg font-semibold text-ink">
                Request a booking
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                With <span className="font-medium text-ink">{vendorDisplayName}</span>
              </p>
              {searchPrefill?.datesFlexible ? (
                <p className="mt-2 rounded-lg border border-line bg-surface-3 px-3 py-2 text-xs text-ink-2">
                  You searched with flexible dates. Confirm dates before sending.
                </p>
              ) : null}
              {searchPrefill?.eventDate && !searchPrefill.datesFlexible ? (
                <p className="mt-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs text-ink-2">
                  Dates from your search.
                </p>
              ) : null}
            </div>
          </>
        }
        footer={
          <Button variant="primary" size="md" onClick={submit} loading={submitting} className="w-full py-3">
            Send booking request
          </Button>
        }
      >
          {dateConflictMessage ? <Banner tone="warning">{dateConflictMessage}</Banner> : null}
          {bannerVisible && pendingPrefill ? (
            <ActiveEventPrefillBanner
              prefill={pendingPrefill}
              onUse={() => {
                applyBannerPrefill();
                setValidationError(null);
              }}
              onNewEvent={dismissForNewEvent}
            />
          ) : null}
          <div>
            <label htmlFor="booking-event-name" className={FIELD_LABEL_CLASS}>
              Event name
            </label>
            <input
              id="booking-event-name"
              type="text"
              value={eventName}
              onChange={(e) => {
                setEventName(e.target.value);
                setValidationError(null);
              }}
              placeholder="e.g. Ade and Kemi - wedding reception"
              className={FIELD_INPUT_CLASS}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="booking-event-date" className={FIELD_LABEL_CLASS}>
                Event date
              </label>
              <DateInput
                id="booking-event-date"
                min={minEventDate}
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value);
                  setValidationError(null);
                }}
                shellClassName="mt-1.5"
                className="focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="booking-event-end" className={FIELD_LABEL_CLASS}>
                End date <span className="font-normal normal-case text-ink-3/65">(optional)</span>
              </label>
              <DateInput
                id="booking-event-end"
                allowEmpty
                min={eventDate.trim() || minEventDate}
                value={eventEndDate}
                onChange={(e) => {
                  setEventEndDate(e.target.value);
                  setValidationError(null);
                }}
                shellClassName="mt-1.5"
                className="focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {workingDaysSentence || blockedDatesSentence ? (
            <div className="rounded-lg border border-line bg-surface-3 px-3 py-2 text-xs leading-relaxed text-ink-2">
              {workingDaysSentence ? <p>{workingDaysSentence}</p> : null}
              {blockedDatesSentence ? (
                <p className={workingDaysSentence ? "mt-1" : ""}>{blockedDatesSentence}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label htmlFor="booking-venue-address" className={FIELD_LABEL_CLASS}>
              Venue location <span className="font-normal normal-case text-ink-3/65">(optional)</span>
            </label>
            <textarea
              id="booking-venue-address"
              rows={3}
              value={venueAddress}
              onChange={(e) => {
                setVenueAddress(e.target.value);
                setValidationError(null);
              }}
              placeholder="e.g. The Grand Hall, 12 Park Lane, London"
              className={`${FIELD_INPUT_CLASS} resize-y`}
            />
            <p className="mt-1 text-xs text-ink-3">Add before you pay.</p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="block text-xs font-semibold uppercase tracking-wide text-ink-3">Packages &amp; rates</p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Pencil className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                Change
              </button>
            </div>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {selectedOptions.map((opt) => {
                const perUnit = opt.pricingMode === "per_unit";
                const qty = quantities[opt.id] ?? opt.minQuantity;
                const lineTotal = perUnit ? lineTotalGbp(opt.unitPriceGbp, qty) : opt.unitPriceGbp;
                const lineLabel = lineTotal != null ? formatGbp(lineTotal, { prefix: "GBP " }) : null;
                return (
                  <li key={opt.id} className="space-y-2 px-3 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{opt.heading}</span>
                      <div className="shrink-0 text-right">
                        {lineLabel != null ? (
                          <>
                            {perUnit && opt.priceDisplay != null ? (
                              <p className="text-xs text-ink-3">
                                {qty} × GBP {opt.priceDisplay}
                                {opt.priceSuffix ? ` ${opt.priceSuffix}` : ""}
                              </p>
                            ) : opt.compareAtDisplay ? (
                              <p className="text-xs text-ink-3 line-through">GBP {opt.compareAtDisplay}</p>
                            ) : null}
                            <p
                              className={`text-sm font-semibold ${
                                opt.compareAtDisplay && !perUnit ? "text-primary" : "text-ink"
                              }`}
                            >
                              {lineLabel}
                            </p>
                            {opt.discountBadge ? (
                              <p className="mt-0.5 text-xs font-medium text-success">{opt.discountBadge}</p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-sm font-semibold text-ink">TBC</span>
                        )}
                      </div>
                    </div>
                    {perUnit ? (
                      <QuantityStepper
                        value={qty}
                        min={opt.minQuantity}
                        max={opt.maxQuantity}
                        onChange={(next) => setPackageQuantity(opt.id, next)}
                        aria-label={`Quantity for ${opt.heading}`}
                      />
                    ) : null}
                  </li>
                );
              })}
              {estimate.autoLines.map((line) => (
                <li
                  key={line.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 bg-success-soft px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-success">{line.heading}</span>
                  <span className="shrink-0 text-sm font-semibold text-success">
                    {line.unitPriceGbp != null
                      ? formatGbp(Math.abs(line.unitPriceGbp), { prefix: "GBP " })
                      : "TBC"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="booking-notes" className={FIELD_LABEL_CLASS}>
              Details for the vendor
            </label>
            <textarea
              id="booking-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={CLIENT_BOOKING_NOTES_MAX_LENGTH}
              placeholder="Guest count, venue, dietary needs, timeline, or questions…"
              className={`${FIELD_INPUT_CLASS} resize-y`}
            />
            <p className="mt-1 text-right text-xs text-ink-3">
              {notes.length}/{CLIENT_BOOKING_NOTES_MAX_LENGTH}
            </p>
          </div>

          {referralFieldsOpen ? (
            <div>
              <label htmlFor="booking-referral-code" className={FIELD_LABEL_CLASS}>
                Referral code <span className="font-normal normal-case text-ink-3/65">(optional)</span>
              </label>
              <input
                ref={referralInputRef}
                id="booking-referral-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                onBlur={onReferralCodeBlur}
                autoComplete="off"
                placeholder="Up to 6 digits from the vendor"
                className={`${FIELD_INPUT_CLASS} font-mono`}
              />
              {referralValidating ? (
                <p className="mt-1 text-xs text-ink-3">Checking code…</p>
              ) : referralApplied ? (
                <p className="mt-1 text-xs font-medium text-success">
                  Referral discount applied: {clientFeeBreakdown?.referralDiscountLabel?.replace("-", "")} off
                  your Eventtz fee
                </p>
              ) : referralError ? (
                <p className="mt-1 text-xs text-danger">{referralError}</p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setReferralFieldsOpen(true);
                window.setTimeout(() => referralInputRef.current?.focus(), 0);
              }}
              className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              Referral code?
            </button>
          )}

          <Card variant="muted" padding="md">
            {clientFeeBreakdown ? (
              <ClientFeeBreakdownSummary
                breakdown={clientFeeBreakdown}
                footnote="The vendor may adjust the price before you pay."
              />
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-2">Estimated total</span>
                  <span className="font-heading text-lg font-semibold text-ink">
                    {estimate.label.replace(/^GBP\s/, "£")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-3">The vendor may adjust the price before you pay.</p>
              </>
            )}
            {depositLine ? (
              <p className="mt-2 border-t border-line pt-2 text-xs text-ink-2">{depositLine}</p>
            ) : null}
          </Card>

          {validationError ? <LottieFailureInline message={validationError} /> : null}
      </Modal>
    </>
  );
}
