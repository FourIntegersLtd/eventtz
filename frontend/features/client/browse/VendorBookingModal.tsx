"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarRange, Pencil, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import {
  getBookingRequestErrorMessage,
  postBookingRequest,
} from "@/lib/clientBookingApi";
import {
  isoDatesInEventRange,
  vendorPayloadAllowsEventDates,
} from "@/lib/vendorAvailability";
import {
  computeBookingEstimateGbp,
  formatBookingEstimateLabel,
} from "@/lib/vendorDiscountDisplay";
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";
import { todayIsoDate, isPastIsoDate } from "@/lib/eventDateValidation";
import { clientBookingRequestSchema, parseForm } from "@/lib/validation";
import {
  type BrowsePricingOption,
  buildBookingLineItems,
} from "./vendorBrowseDetailModel";

export type VendorBookingSearchPrefill = {
  /** YYYY-MM-DD from marketplace search (first selected day). */
  eventDate?: string;
  eventEndDate?: string;
  datesFlexible: boolean;
};

type VendorBookingModalProps = {
  onClose: () => void;
  /** Called once the request is created — the caller owns navigation to the new booking's detail page. */
  onSuccess?: (bookingId: string) => void;
  vendorDisplayName: string;
  vendorUserId: string;
  pricingOptions: BrowsePricingOption[];
  /** Package / rate ids selected on the profile sidebar — fixed for this modal; change selection by closing and re-picking there. */
  initialSelectedIds: string[];
  /** Vendor onboarding payload — used to warn if chosen dates conflict with calendar. */
  vendorPayload?: Record<string, unknown>;
  /** Dates/types from marketplace URL on `/client/browse/[id]?…`. */
  searchPrefill?: VendorBookingSearchPrefill;
};

export function VendorBookingModal({
  onClose,
  onSuccess,
  vendorDisplayName,
  vendorUserId,
  pricingOptions,
  initialSelectedIds,
  vendorPayload,
  searchPrefill,
}: VendorBookingModalProps) {
  // Selection happens once, on the profile sidebar — this modal only confirms dates/venue/notes.
  const selectedIds = useMemo(() => new Set(initialSelectedIds), [initialSelectedIds]);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(
    searchPrefill?.eventDate?.trim() ? searchPrefill.eventDate : todayIsoDate(),
  );
  const [eventEndDate, setEventEndDate] = useState(searchPrefill?.eventEndDate ?? "");
  const [venueAddress, setVenueAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<null | { type: "error"; message: string }>(
    null,
  );

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

  const calendarConflict = useMemo(() => {
    if (!vendorPayload || !eventDate.trim()) return false;
    const end = eventEndDate.trim() || null;
    const range = isoDatesInEventRange(eventDate.trim(), end);
    if (range.length === 0) return false;
    return !vendorPayloadAllowsEventDates(vendorPayload, range);
  }, [vendorPayload, eventDate, eventEndDate]);

  const dismissResultModal = () => setSubmitResult(null);

  const lineItems = useMemo(
    () => buildBookingLineItems(pricingOptions, [...selectedIds]),
    [pricingOptions, selectedIds],
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
      autoLines: result.autoLines,
    };
  }, [lineItems, vendorPayload, eventDate]);

  const clientEstimateLabel = useMemo(() => {
    if (estimate.label === "TBC" || estimate.label.includes("TBC")) {
      return estimate.label;
    }
    const match = estimate.label.match(/[\d,.]+/);
    if (!match) return estimate.label;
    const vendorPortion = Number.parseFloat(match[0].replace(/,/g, ""));
    if (!Number.isFinite(vendorPortion)) return estimate.label;
    const feePct = getBookingServiceFeePercent();
    const withFee = Math.round(vendorPortion * (1 + feePct / 100) * 100) / 100;
    return formatBookingEstimateLabel(withFee, false);
  }, [estimate.label]);

  const minEventDate = todayIsoDate();

  const submit = () => {
    const parsed = parseForm(clientBookingRequestSchema, {
      eventName,
      eventDate,
      eventEndDate: eventEndDate || null,
      venueAddress,
      notes,
      selectedOptionIds: [...selectedIds],
    });
    if (!parsed.ok) {
      setValidationError(parsed.formError);
      return;
    }
    if (calendarConflict) {
      setValidationError(
        "These dates don’t match this vendor’s availability. Adjust the dates or message them to confirm.",
      );
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    void postBookingRequest({
      vendor_user_id: vendorUserId,
      event_name: parsed.data.eventName,
      event_date: parsed.data.eventDate,
      event_end_date: parsed.data.eventEndDate?.trim() || null,
      event_postcode: null,
      event_address: (parsed.data.venueAddress ?? "").trim() || null,
      notes: (parsed.data.notes ?? "").trim() || null,
      selected_option_ids: parsed.data.selectedOptionIds,
    })
      .then((created) => {
        onSuccess?.(created.id);
      })
      .catch((err: unknown) => {
        setSubmitResult({ type: "error", message: getBookingRequestErrorMessage(err) });
        setSubmitting(false);
      });
  };

  return (
    <>
    <Modal
      isOpen={submitResult !== null}
      onClose={dismissResultModal}
      zIndexClassName="z-[60]"
      maxWidthClassName="max-w-md"
      title="Couldn’t send request"
      footer={
        <Button variant="primary" onClick={dismissResultModal} className="w-full">
          Back to form
        </Button>
      }
    >
      {submitResult ? (
        <div className="flex gap-3">
          <span className="shrink-0 text-red-600" aria-hidden>
            <AlertCircle className="h-6 w-6" strokeWidth={2} />
          </span>
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
                placeholder="e.g. Ade and Kemi — wedding reception"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  .map((opt) => (
                    <li key={opt.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5">
                      <span className="text-sm font-medium text-neutral-900">{opt.heading}</span>
                      <div className="shrink-0 text-right">
                        {opt.priceDisplay != null ? (
                          <>
                            {opt.compareAtDisplay ? (
                              <p className="text-xs text-neutral-500 line-through">
                                GBP {opt.compareAtDisplay}
                              </p>
                            ) : null}
                            <p
                              className={`text-sm font-semibold ${
                                opt.compareAtDisplay ? "text-primary" : "text-neutral-900"
                              }`}
                            >
                              GBP {opt.priceDisplay}
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
                    </li>
                  ))}
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
                className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-right text-xs text-neutral-400">{notes.length}/2000</p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Estimated total</span>
                <span className="font-heading text-lg font-semibold text-neutral-900">
                  {clientEstimateLabel}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Includes Eventtz fee. The vendor may adjust the price before you pay.
              </p>
            </div>

            {validationError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {validationError}
              </p>
            ) : null}
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
