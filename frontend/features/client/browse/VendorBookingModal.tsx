"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Pencil, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { DateInput } from "@/components/ui/DateInput";
import {
  isoDatesInEventRange,
  vendorPayloadAllowsEventDates,
} from "@/lib/vendorAvailability";
import {
  computeBookingEstimateGbp,
  formatBookingEstimateLabel,
} from "@/lib/vendorDiscountDisplay";
import { computeClientFeeBreakdown } from "@/lib/bookingServiceFee";
import { ClientFeeBreakdownSummary } from "@/features/bookings/ClientFeeBreakdownSummary";
import { todayIsoDate, isPastIsoDate } from "@/lib/eventDateValidation";
import {
  type BrowsePricingOption,
  bookingQuantitiesPayload,
  buildBookingLineItems,
} from "./vendorBrowseDetailModel";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { lineTotalGbp } from "@/lib/packagePricing";
import { useVendorBookingSubmit } from "@/features/client/browse/useVendorBookingSubmit";
import type { ClientSearchContext } from "@/lib/clientBookingsApi";
import { ActiveEventPrefillBanner } from "@/features/bookings/ActiveEventPrefillBanner";
import type { EventEnquirePrefill } from "@/features/bookings/eventEnquirePrefill";
import {
  applyPrefillToFields,
  applyLinkedPrefillToForm,
  useActiveEventPrefill,
} from "@/features/bookings/useActiveEventPrefill";

export type VendorBookingSearchPrefill = {
  /** YYYY-MM-DD from marketplace search (first selected day). */
  eventDate?: string;
  eventEndDate?: string;
  datesFlexible: boolean;
};

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
}: VendorBookingModalProps) {
  // Packages are chosen on the profile; quantity for per-item rates can still change here.
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds));
  const [quantities, setQuantities] = useState<Record<string, number>>(
    () => ({ ...initialQuantities }),
  );
  const [eventName, setEventName] = useState(initialPrefill?.eventName ?? "");
  const [eventDate, setEventDate] = useState(
    searchPrefill?.eventDate?.trim() ||
      initialPrefill?.eventDate?.trim() ||
      todayIsoDate(),
  );
  const [eventEndDate, setEventEndDate] = useState(
    searchPrefill?.eventEndDate ?? initialPrefill?.eventEndDate ?? "",
  );
  const [venueAddress, setVenueAddress] = useState(initialPrefill?.venueAddress ?? "");
  const [notes, setNotes] = useState(initialPrefill?.notes ?? "");

  const setPackageQuantity = (id: string, qty: number) => {
    const opt = pricingOptions.find((o) => o.id === id);
    setQuantities((prev) => ({ ...prev, [id]: qty }));
    if (opt?.pricingMode === "per_unit") {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (qty >= opt.minQuantity) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  };
  const {
    pendingPrefill,
    linkedPrefill,
    selectedEventId,
    bannerVisible,
    applyPrefill,
    dismissForNewEvent,
  } = useActiveEventPrefill({ linkedEventId });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (searchPrefill?.eventDate) {
      const d = searchPrefill.eventDate;
      setEventDate(isPastIsoDate(d) ? "" : d);
    }
    if (searchPrefill?.eventEndDate !== undefined) {
      const end = searchPrefill.eventEndDate ?? "";
      setEventEndDate(end && isPastIsoDate(end) ? "" : end);
    }
  }, [searchPrefill?.eventDate, searchPrefill?.eventEndDate]);

  useEffect(() => {
    if (selectedEventId || bannerVisible || linkedPrefill || !initialPrefill) return;
    if (initialPrefill.eventName) setEventName(initialPrefill.eventName);
    if (initialPrefill.eventDate) setEventDate(initialPrefill.eventDate);
    if (initialPrefill.eventEndDate) setEventEndDate(initialPrefill.eventEndDate);
    if (initialPrefill.venueAddress) setVenueAddress(initialPrefill.venueAddress);
    if (initialPrefill.notes) setNotes(initialPrefill.notes);
  }, [initialPrefill, selectedEventId, bannerVisible, linkedPrefill]);

  useEffect(() => {
    applyLinkedPrefillToForm(linkedPrefill, {
      setEventName,
      setEventDate,
      setEventEndDate,
      setVenueAddress,
    });
  }, [linkedPrefill]);

  const calendarConflict = useMemo(() => {
    if (!vendorPayload || !eventDate.trim()) return false;
    const end = eventEndDate.trim() || null;
    const range = isoDatesInEventRange(eventDate.trim(), end);
    if (range.length === 0) return false;
    return !vendorPayloadAllowsEventDates(vendorPayload, range);
  }, [vendorPayload, eventDate, eventEndDate]);

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
    calendarConflict,
  });

  const lineItems = useMemo(
    () => buildBookingLineItems(pricingOptions, [...selectedIds], quantities),
    [pricingOptions, selectedIds, quantities],
  );

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

  const clientFeeBreakdown = useMemo(() => {
    if (estimate.hasTbc) return null;
    return computeClientFeeBreakdown({ vendorPortionGbp: estimate.sumNumeric });
  }, [estimate.sumNumeric, estimate.hasTbc]);

  const minEventDate = todayIsoDate();

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
    });
  };

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
          <p className="text-sm leading-relaxed text-neutral-700">
            Your booking request was sent to {vendorDisplayName}. They&apos;ll respond in your
            bookings inbox.
          </p>
        </div>
      ) : submitResult?.type === "error" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <LottieIllustration asset="failure" size="status" ariaLabel="" />
          <p className="text-sm leading-relaxed text-red-900">{submitResult.message}</p>
        </div>
      ) : null}
    </Modal>
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/45"
        onClick={() => {
          if (submitResult) return;
          onClose();
        }}
      />
      <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 pt-6 sm:pt-10">
        <div
          className="relative my-auto w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
        >
          <button
            type="button"
            onClick={() => {
              if (submitResult) return;
              onClose();
            }}
            className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="border-b border-neutral-100 px-5 pb-4 pt-5 pr-14 sm:px-6 sm:pr-16">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarRange className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <h2
              id="booking-modal-title"
              className="mt-3 font-heading text-lg font-semibold text-neutral-900"
            >
              Request a booking
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              With{" "}
              <span className="font-medium text-neutral-800">{vendorDisplayName}</span>
            </p>
            {searchPrefill?.datesFlexible ? (
              <p className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                You searched with flexible dates. Confirm dates before sending.
              </p>
            ) : null}
            {searchPrefill?.eventDate && !searchPrefill.datesFlexible ? (
              <p className="mt-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs text-neutral-700">
                Dates from your search.
              </p>
            ) : null}
          </div>

          <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            {calendarConflict ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                These dates may not work for this vendor. Pick new dates or message them.
              </div>
            ) : null}
            {bannerVisible && pendingPrefill ? (
              <ActiveEventPrefillBanner
                prefill={pendingPrefill}
                onUse={() => {
                  const fields = applyPrefillToFields(applyPrefill(pendingPrefill));
                  setEventName(fields.eventName);
                  setEventDate(fields.eventDate);
                  setEventEndDate(fields.eventEndDate);
                  setVenueAddress(fields.venueAddress);
                  setValidationError(null);
                }}
                onNewEvent={dismissForNewEvent}
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
                id="booking-event-name"
                type="text"
                value={eventName}
                onChange={(e) => {
                  setEventName(e.target.value);
                  setValidationError(null);
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
                <label
                  htmlFor="booking-event-end"
                  className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  End date <span className="font-normal normal-case text-neutral-400">(optional)</span>
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

            <div>
              <label
                htmlFor="booking-venue-address"
                className="block text-xs font-semibold uppercase tracking-wide text-neutral-500"
              >
                Venue location{" "}
                <span className="font-normal normal-case text-neutral-400">(optional)</span>
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
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  Change
                </button>
              </div>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {pricingOptions
                  .filter((opt) => selectedIds.has(opt.id))
                  .map((opt) => {
                    const perUnit = opt.pricingMode === "per_unit";
                    const qty = quantities[opt.id] ?? opt.minQuantity;
                    const lineTotal = perUnit
                      ? lineTotalGbp(opt.unitPriceGbp, qty)
                      : opt.unitPriceGbp;
                    const lineLabel =
                      lineTotal != null
                        ? `GBP ${lineTotal.toLocaleString("en-GB", {
                            minimumFractionDigits: lineTotal % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}`
                        : null;
                    return (
                    <li key={opt.id} className="space-y-2 px-3 py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-900">{opt.heading}</span>
                        <div className="shrink-0 text-right">
                          {lineLabel != null ? (
                            <>
                              {perUnit && opt.priceDisplay != null ? (
                                <p className="text-xs text-neutral-500">
                                  {qty} × GBP {opt.priceDisplay}
                                  {opt.priceSuffix ? ` ${opt.priceSuffix}` : ""}
                                </p>
                              ) : opt.compareAtDisplay ? (
                                <p className="text-xs text-neutral-500 line-through">
                                  GBP {opt.compareAtDisplay}
                                </p>
                              ) : null}
                              <p
                                className={`text-sm font-semibold ${
                                  opt.compareAtDisplay && !perUnit ? "text-primary" : "text-neutral-900"
                                }`}
                              >
                                {lineLabel}
                              </p>
                              {opt.discountBadge ? (
                                <p className="mt-0.5 text-xs font-medium text-green-700">
                                  {opt.discountBadge}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-neutral-900">TBC</span>
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
                    className="flex flex-wrap items-baseline justify-between gap-2 bg-emerald-50/60 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-emerald-900">{line.heading}</span>
                    <span className="shrink-0 text-sm font-semibold text-emerald-800">
                      {line.unitPriceGbp != null
                        ? `GBP ${Math.abs(line.unitPriceGbp).toLocaleString("en-GB", {
                            minimumFractionDigits: line.unitPriceGbp % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}`
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
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Guest count, venue, dietary needs, timeline, or questions…"
                className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{notes.length}/2000</p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              {clientFeeBreakdown ? (
                <ClientFeeBreakdownSummary
                  breakdown={clientFeeBreakdown}
                  footnote="The vendor may adjust the price before you pay."
                />
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Estimated total</span>
                    <span className="font-heading text-lg font-semibold text-neutral-900">
                      {estimate.label.replace(/^GBP\s/, "£")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    The vendor may adjust the price before you pay.
                  </p>
                </>
              )}
            </div>

            {validationError ? <LottieFailureInline message={validationError} /> : null}
          </div>

          <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
            <Button variant="primary" size="md" onClick={submit} loading={submitting} className="w-full py-3">
              Send booking request
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
