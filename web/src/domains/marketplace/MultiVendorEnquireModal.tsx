"use client";

/**
 * Shared brief for several vendors. Each vendor is posted in turn to
 * `POST /api/v1/client/booking-requests`. Estimates stay in the package labels.
 * There is no toast: a failed or partial send stays as a notice in this dialog.
 * All-success closes and lets the parent clear the selection and navigate.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/foundation/ui";
import { platformErrorDetail } from "@/foundation/platform-client";
import { createClientBookingRequest } from "./api";
import {
  CLIENT_BOOKING_NOTES_MAX_LENGTH,
  todayIsoDate,
  validateClientBookingEnquiry,
} from "./bookingRequestValidation";
import type { ClientSearchContext, EventEnquirePrefill, MarketplaceBookingSearchPrefill } from "./marketplaceSearchParams";
import { useEnquireEventFormState } from "./useEnquireEventFormState";
import { vendorUserIdsWithCalendarConflict } from "./vendorAvailability";
import { ActiveEventPrefillBanner } from "./VendorBookingModalParts";
import { MultiVendorPackagePicker } from "./MultiVendorPackagePicker";
import {
  buildMultiVendorEnquirePayloads,
  calendarConflictMessage,
  defaultQuantityForOption,
  initialOptionSelections,
  initialQuantitiesForVendors,
  missingPackageMessage,
  pricingOptionsForVendor,
  summarizeMultiVendorSend,
  vendorDisplayName,
  type MultiVendorPackageChoice,
  type MultiVendorRow,
} from "./multiVendorEnquire";

type MultiVendorEnquireModalProps = {
  vendors: MultiVendorRow[];
  clientSearchContext?: ClientSearchContext | null;
  searchPrefill?: MarketplaceBookingSearchPrefill;
  initialPrefill?: EventEnquirePrefill | null;
  enquirySource?: "multi" | "planner";
  linkedEventId?: string | null;
  onClose: () => void;
  onSuccess: (createdIds: string[]) => void;
};

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm";

/** Dialog title, shared event fields, one package each, then sequential posts. */
export function MultiVendorEnquireModal({
  vendors,
  clientSearchContext,
  searchPrefill,
  initialPrefill,
  enquirySource = "multi",
  linkedEventId,
  onClose,
  onSuccess,
}: MultiVendorEnquireModalProps) {
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
  const [selectedOptionByVendorId, setSelectedOptionByVendorId] = useState<Record<string, string>>(
    () => initialOptionSelections(vendors),
  );
  const [quantityByVendorId, setQuantityByVendorId] = useState<Record<string, number>>(() =>
    initialQuantitiesForVendors(vendors, initialOptionSelections(vendors)),
  );
  const [error, setError] = useState<string | null>(null);
  const [failureDetails, setFailureDetails] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const calendarConflictVendorIds = useMemo(
    () =>
      vendorUserIdsWithCalendarConflict(
        vendors.map((vendor) => ({
          user_id: vendor.user_id,
          profile_form_data: vendor.profile_form_data ?? undefined,
        })),
        eventDate,
        eventEndDate,
      ),
    [vendors, eventDate, eventEndDate],
  );
  const calendarNotice = useMemo(
    () => calendarConflictMessage(vendors, calendarConflictVendorIds, eventDate),
    [vendors, calendarConflictVendorIds, eventDate],
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || submitting) return;
      onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, submitting]);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const selectOption = (vendorUserId: string, optionId: string) => {
    setSelectedOptionByVendorId((previous) => ({ ...previous, [vendorUserId]: optionId }));
    const vendor = vendors.find((entry) => entry.user_id === vendorUserId);
    const option = vendor
      ? pricingOptionsForVendor(vendor).find((entry) => entry.id === optionId)
      : undefined;
    setQuantityByVendorId((previous) => {
      const next = { ...previous };
      if (option?.pricingMode === "per_unit") {
        next[vendorUserId] = defaultQuantityForOption(option);
      } else {
        delete next[vendorUserId];
      }
      return next;
    });
    setError(null);
    setFailureDetails(null);
  };

  const submit = () => {
    const missing = vendors.find((vendor) => !selectedOptionByVendorId[vendor.user_id]);
    if (missing) {
      setError(missingPackageMessage(vendorDisplayName(missing)));
      setFailureDetails(null);
      return;
    }
    const firstOptionId = selectedOptionByVendorId[vendors[0]?.user_id ?? ""] ?? "";
    const parsed = validateClientBookingEnquiry(
      {
        eventName,
        eventDate,
        eventEndDate,
        venueAddress,
        notes,
        selectedOptionIds: [firstOptionId],
      },
      false,
    );
    if (!parsed.ok) {
      setError(parsed.error);
      setFailureDetails(null);
      return;
    }
    if (calendarNotice) {
      setError(calendarNotice);
      setFailureDetails(null);
      return;
    }

    const choices: MultiVendorPackageChoice[] = vendors.map((vendor) => {
      const optionId = selectedOptionByVendorId[vendor.user_id] ?? "";
      const options = pricingOptionsForVendor(vendor);
      const option = options.find((entry) => entry.id === optionId);
      return {
        userId: vendor.user_id,
        optionId,
        quantityOptions: options.map((entry) => ({
          id: entry.id,
          pricingMode: entry.pricingMode,
          minQuantity: entry.minQuantity,
        })),
        quantity:
          option?.pricingMode === "per_unit"
            ? (quantityByVendorId[vendor.user_id] ?? defaultQuantityForOption(option))
            : undefined,
      };
    });

    setError(null);
    setFailureDetails(null);
    setSubmitting(true);
    void (async () => {
      const createdIds: string[] = [];
      const failures: string[] = [];
      let linkedEventIdForBatch = selectedEventId;
      const payloads = buildMultiVendorEnquirePayloads({
        form: parsed.data,
        choices,
        clientSearchContext,
        enquirySource,
        eventId: linkedEventIdForBatch,
      });
      for (const [index, payload] of payloads.entries()) {
        const vendor = vendors[index];
        try {
          const created = await createClientBookingRequest({
            ...payload,
            event_id: linkedEventIdForBatch,
          });
          createdIds.push(created.booking_request_id);
          if (created.event_id && !linkedEventIdForBatch) {
            linkedEventIdForBatch = created.event_id;
          }
        } catch (error: unknown) {
          const detail = platformErrorDetail(error) ?? "failed";
          failures.push(`${vendor ? vendorDisplayName(vendor) : "Vendor"}: ${detail}`);
        }
      }
      setSubmitting(false);
      const outcome = summarizeMultiVendorSend(createdIds.length, payloads.length);
      if (outcome.kind === "none") {
        setError(outcome.message);
        setFailureDetails(failures.join("\n") || null);
        return;
      }
      if (outcome.kind === "partial") {
        setError(outcome.message);
        setFailureDetails(failures.join("\n") || null);
        return;
      }
      onSuccess(createdIds);
    })();
  };

  const minEventDate = todayIsoDate();

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45" onClick={close} />
      <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 pt-6 sm:pt-10">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="multi-enquire-title"
          className="relative my-auto w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        >
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Close"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
          <div className="border-b border-neutral-100 px-5 pb-4 pr-14 pt-5 sm:px-6">
            <h2 id="multi-enquire-title" className="text-lg font-semibold text-neutral-900">
              Request from {vendors.length} vendors
            </h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
              <MultiVendorPackagePicker
                vendors={vendors}
                selectedOptionByVendorId={selectedOptionByVendorId}
                onSelectOption={selectOption}
                quantityByVendorId={quantityByVendorId}
                onQuantityChange={(vendorUserId, quantity) => {
                  setQuantityByVendorId((previous) => ({ ...previous, [vendorUserId]: quantity }));
                  setError(null);
                  setFailureDetails(null);
                }}
              />
              {error ? (
                <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              ) : null}
              {failureDetails ? (
                <p className="whitespace-pre-wrap text-sm text-red-800">{failureDetails}</p>
              ) : null}
              {calendarNotice ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {calendarNotice}
                </div>
              ) : null}
              {bannerVisible && pendingPrefill ? (
                <ActiveEventPrefillBanner
                  prefill={pendingPrefill}
                  onUse={() => {
                    applyBannerPrefill();
                    setError(null);
                    setFailureDetails(null);
                  }}
                  onNewEvent={dismissForNewEvent}
                />
              ) : null}
              <label className="block text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Event name
                </span>
                <input
                  id="multi-enquire-event-name"
                  className={fieldClassName}
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  placeholder="e.g. Summer garden party"
                  maxLength={500}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Event date
                  </span>
                  <input
                    id="multi-enquire-event-date"
                    type="date"
                    min={minEventDate}
                    className={fieldClassName}
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    End date <span className="font-normal normal-case text-neutral-400">(optional)</span>
                  </span>
                  <input
                    id="multi-enquire-event-end"
                    type="date"
                    min={eventDate.trim() || minEventDate}
                    className={fieldClassName}
                    value={eventEndDate}
                    onChange={(event) => setEventEndDate(event.target.value)}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Venue address <span className="font-normal normal-case text-neutral-400">(optional)</span>
                </span>
                <input
                  id="multi-enquire-venue"
                  className={fieldClassName}
                  value={venueAddress}
                  onChange={(event) => setVenueAddress(event.target.value)}
                  maxLength={500}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Notes <span className="font-normal normal-case text-neutral-400">(optional)</span>
                </span>
                <textarea
                  id="multi-enquire-notes"
                  className={fieldClassName}
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={CLIENT_BOOKING_NOTES_MAX_LENGTH}
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-5 py-4 sm:px-6">
              <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Send requests
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
