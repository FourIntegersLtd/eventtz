"use client";

/**
 * Booking request dialog for a signed-in client.
 * The estimate and fee rows are display only. Submit posts package ids and
 * quantities; the API sets the price. There is no toast primitive, so success
 * stays in this dialog until "View booking".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { computeClientFeeBreakdown } from "./bookingServiceFee";
import { eventDatesConflictWithVendor, todayIsoDate } from "./bookingRequestValidation";
import type { ClientSearchContext, EventEnquirePrefill, MarketplaceBookingSearchPrefill } from "./marketplaceSearchParams";
import { useEnquireEventFormState } from "./useEnquireEventFormState";
import { usePerUnitPackageSelection } from "./usePerUnitPackageSelection";
import { useVendorBookingSubmit } from "./useVendorBookingSubmit";
import { useVendorReferralPreview } from "./useVendorReferralPreview";
import { computeBookingEstimateGbp, formatBookingEstimateLabel } from "./vendorDiscountDisplay";
import type { BrowsePricingOption } from "./vendorBrowseDetailModel";
import { VendorBookingForm } from "./VendorBookingForm";
import { BookingResultDialog } from "./VendorBookingModalParts";

type VendorBookingModalProps = {
  onClose: () => void;
  vendorDisplayName: string;
  vendorUserId: string;
  pricingOptions: BrowsePricingOption[];
  initialSelectedIds: string[];
  initialQuantities?: Record<string, number>;
  vendorPayload?: Record<string, unknown>;
  searchPrefill?: MarketplaceBookingSearchPrefill;
  initialPrefill?: EventEnquirePrefill | null;
  linkedEventId?: string | null;
  clientSearchContext?: ClientSearchContext | null;
  initialReferralCode?: string | null;
};

/** The baseline booking form, posted without a client-computed price. */
export function VendorBookingModal({
  onClose,
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
  const router = useRouter();
  const eventNameRef = useRef<HTMLInputElement>(null);
  const referralInputRef = useRef<HTMLInputElement>(null);
  const [referralFieldsOpen, setReferralFieldsOpen] = useState(
    () => Boolean(initialReferralCode?.trim()),
  );
  const openReferral = () => {
    setReferralFieldsOpen(true);
    window.setTimeout(() => referralInputRef.current?.focus(), 0);
  };

  const { selectedIds, quantities, setPackageQuantity, lineItems } = usePerUnitPackageSelection({
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

  const calendarConflict = useMemo(
    () => eventDatesConflictWithVendor(vendorPayload, eventDate, eventEndDate),
    [vendorPayload, eventDate, eventEndDate],
  );

  const estimate = useMemo(() => {
    const positiveLines = lineItems.map((line) => ({
      id: line.id,
      heading: line.heading,
      unitPriceGbp: line.unitPriceGbp,
    }));
    if (!vendorPayload) {
      const hasTbc = positiveLines.some((line) => line.unitPriceGbp == null);
      const sum = positiveLines.reduce((total, line) => total + (line.unitPriceGbp ?? 0), 0);
      return {
        label: formatBookingEstimateLabel(sum, hasTbc),
        sumNumeric: sum,
        hasTbc,
        autoLines: [] as { id: string; heading: string; unitPriceGbp: number | null }[],
      };
    }
    const result = computeBookingEstimateGbp(positiveLines, vendorPayload, eventDate.trim() || null);
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

  const quantityOptions = useMemo(
    () =>
      pricingOptions.map((option) => ({
        id: option.id,
        pricingMode: option.pricingMode,
        minQuantity: option.minQuantity,
      })),
    [pricingOptions],
  );

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
    quantityOptions,
  });

  const clientFeeBreakdown = useMemo(() => {
    if (estimate.hasTbc) return null;
    return computeClientFeeBreakdown({
      vendorPortionGbp: estimate.sumNumeric,
      referralFeeDiscountGbp: referralDiscountGbp,
    });
  }, [estimate.sumNumeric, estimate.hasTbc, referralDiscountGbp]);

  useEffect(() => {
    eventNameRef.current?.focus();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || submitting) return;
      if (submitResult) {
        dismissResultModal();
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, submitting, submitResult, dismissResultModal]);

  const minEventDate = todayIsoDate();
  const selectedOptions = pricingOptions.filter((option) => selectedIds.has(option.id));

  const submit = () => {
    submitBooking({
      eventName,
      eventDate,
      eventEndDate,
      venueAddress,
      notes,
      selectedOptionIds: [...selectedIds],
      quantities,
      vendorReferralCode: normalizedReferralCode,
    });
  };

  const closeForm = () => {
    if (submitResult || submitting) return;
    onClose();
  };

  return (
    <>
      {submitResult ? (
        <BookingResultDialog
          result={submitResult}
          vendorDisplayName={vendorDisplayName}
          onBack={dismissResultModal}
          onViewBooking={(bookingId) => {
            dismissResultModal();
            onClose();
            router.push(`/client/bookings/${bookingId}`);
          }}
        />
      ) : null}

      <div className="fixed inset-0 z-50">
        <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45" onClick={closeForm} />
        <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 pt-6 sm:pt-10">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            className="relative my-auto w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={closeForm}
              className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              aria-label="Close"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ×
              </span>
            </button>

            <div className="border-b border-neutral-100 px-5 pb-4 pr-14 pt-5 sm:px-6 sm:pr-16">
              <h2 id="booking-modal-title" className="font-heading text-lg font-semibold text-neutral-900">
                Request a booking
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                With <span className="font-medium text-neutral-800">{vendorDisplayName}</span>
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

            <VendorBookingForm
              submit={submit}
              closeForm={closeForm}
              calendarConflict={calendarConflict}
              bannerVisible={bannerVisible}
              pendingPrefill={pendingPrefill}
              applyBannerPrefill={applyBannerPrefill}
              setValidationError={setValidationError}
              dismissForNewEvent={dismissForNewEvent}
              eventNameRef={eventNameRef}
              eventName={eventName}
              setEventName={setEventName}
              minEventDate={minEventDate}
              eventDate={eventDate}
              setEventDate={setEventDate}
              eventEndDate={eventEndDate}
              setEventEndDate={setEventEndDate}
              venueAddress={venueAddress}
              setVenueAddress={setVenueAddress}
              selectedOptions={selectedOptions}
              quantities={quantities}
              setPackageQuantity={setPackageQuantity}
              estimate={estimate}
              notes={notes}
              setNotes={setNotes}
              referralFieldsOpen={referralFieldsOpen}
              openReferral={openReferral}
              referralInputRef={referralInputRef}
              referralCode={referralCode}
              setReferralCode={setReferralCode}
              onReferralCodeBlur={onReferralCodeBlur}
              referralValidating={referralValidating}
              referralApplied={referralApplied}
              clientFeeBreakdown={clientFeeBreakdown}
              referralError={referralError}
              validationError={validationError}
              submitting={submitting}
            />
          </div>
        </div>
      </div>
    </>
  );
}
