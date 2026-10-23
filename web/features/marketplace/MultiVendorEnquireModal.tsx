"use client";

import { Banner } from "@/components/ui/Banner";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DateInput } from "@/components/ui/DateInput";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { getApiErrorDetail } from "@/lib/api-errors";
import { buildBookingRequestPayload } from "@/lib/bookingEnquireSubmit";
import {
  postBookingRequest,
  type ClientSearchContext,
} from "@/lib/clientBookingsApi";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";
import {
  initialOptionSelections,
  initialQuantitiesForVendors,
  defaultQuantityForOption,
  pricingOptionsForVendor,
  vendorDisplayName,
} from "@/features/bookings/multiVendorPackageSelection";
import {
  MultiVendorPackagePicker,
} from "@/features/bookings/MultiVendorPackagePicker";
import { bookingQuantitiesPayload } from "@/lib/vendorBrowseDetailModel";
import { todayIsoDate } from "@/lib/eventDateValidation";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { clientBookingRequestSchema, parseForm } from "@/lib/validation";
import { CLIENT_BOOKING_NOTES_MAX_LENGTH } from "@/lib/validation/bookings";
import {
  CLIENT_BOOKING_ERROR_COPY,
  CLIENT_BOOKING_TOAST_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import { withMutationFeedback } from "@/lib/mutationFeedback";
import { ActiveEventPrefillBanner } from "@/features/bookings/ActiveEventPrefillBanner";
import type { EventEnquirePrefill } from "@/features/bookings/eventEnquirePrefill";
import { useEnquireEventFormState } from "@/features/bookings/useEnquireEventFormState";
import type { MarketplaceBookingSearchPrefill } from "@/lib/marketplaceSearchParams";
import { vendorUserIdsWithCalendarConflict } from "@/lib/vendorAvailability";

type MultiVendorEnquireModalProps = {
  vendors: ExploreVendorSearchRow[];
  clientSearchContext: ClientSearchContext;
  searchPrefill?: MarketplaceBookingSearchPrefill;
  /** Pre-fill event fields (e.g. from AI planner) when no active client event exists. */
  initialPrefill?: EventEnquirePrefill;
  enquirySource?: "multi" | "planner";
  /** Non-blocking warning shown above the form (e.g. some vendors skipped). */
  loadWarning?: string | null;
  /** Optional category labels per vendor (planner need names). */
  vendorCategoryLabels?: Record<string, string>;
  linkedEventId?: string | null;
  onClose: () => void;
  onSuccess: (createdIds: string[]) => void;
};

function vendorLabel(vendor: ExploreVendorSearchRow): string {
  return vendorDisplayName(vendor);
}

/**
 * Shared brief for contacting several vendors at once (one booking request each).
 * Client picks one package per vendor before sending.
 */
export function MultiVendorEnquireModal({
  vendors,
  clientSearchContext,
  searchPrefill,
  initialPrefill,
  enquirySource = "multi",
  loadWarning,
  vendorCategoryLabels,
  linkedEventId,
  onClose,
  onSuccess,
}: MultiVendorEnquireModalProps) {
  const { showToast } = useToast();
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
  const [selectedOptionByVendorId, setSelectedOptionByVendorId] = useState<
    Record<string, string>
  >(() => initialOptionSelections(vendors));
  const [quantityByVendorId, setQuantityByVendorId] = useState<Record<string, number>>(
    () =>
      initialQuantitiesForVendors(vendors, initialOptionSelections(vendors)),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const next = initialOptionSelections(vendors);
    setSelectedOptionByVendorId(next);
    setQuantityByVendorId(initialQuantitiesForVendors(vendors, next));
  }, [vendors]);

  const calendarConflictVendorIds = useMemo(
    () => vendorUserIdsWithCalendarConflict(vendors, eventDate, eventEndDate),
    [vendors, eventDate, eventEndDate],
  );

  const calendarConflictMessage = useMemo(() => {
    if (calendarConflictVendorIds.length === 0 || !eventDate.trim()) return null;
    const names = vendors
      .filter((vendor) => calendarConflictVendorIds.includes(vendor.user_id))
      .map(vendorLabel);
    return `These dates don't match availability for: ${names.join(", ")}. Adjust the dates or remove those vendors.`;
  }, [calendarConflictVendorIds, eventDate, vendors]);

  const submit = () => {
    const optionIdsByVendor = vendors.map((vendor) => ({
      vendor,
      optionId: selectedOptionByVendorId[vendor.user_id] ?? null,
    }));
    const missing = optionIdsByVendor.filter((entry) => !entry.optionId);
    if (missing.length > 0) {
      setError(
        `${vendorLabel(missing[0]!.vendor)} has no bookable packages yet. Remove them and try again.`,
      );
      return;
    }

    const parsed = parseForm(clientBookingRequestSchema, {
      eventName,
      eventDate,
      eventEndDate: eventEndDate || null,
      venueAddress,
      notes,
      selectedOptionIds: [optionIdsByVendor[0]!.optionId!],
    });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }

    if (calendarConflictVendorIds.length > 0) {
      setError(calendarConflictMessage);
      return;
    }

    setError(null);
    setSubmitting(true);
    void (async () => {
      const createdIds: string[] = [];
      const failures: string[] = [];
      const batchSize = optionIdsByVendor.length;
      const resolvedSource = clientSearchContext.source ?? enquirySource;
      let linkedEventIdForBatch = selectedEventId;
      for (let index = 0; index < optionIdsByVendor.length; index += 1) {
        const { vendor, optionId } = optionIdsByVendor[index]!;
        const pricingOptions = pricingOptionsForVendor(vendor);
        try {
          const created = await postBookingRequest(
            buildBookingRequestPayload(parsed.data, {
              vendorUserId: vendor.user_id,
              selectedOptionIds: [optionId!],
              quantities: bookingQuantitiesPayload(
                [optionId!],
                pricingOptions,
                {
                  [optionId!]:
                    quantityByVendorId[vendor.user_id] ??
                    defaultQuantityForOption(
                      pricingOptions.find((option) => option.id === optionId)!,
                    ),
                },
              ),
              clientSearchContext: {
                ...clientSearchContext,
                batchSize,
                batchIndex: index,
                source: resolvedSource,
              },
              eventId: linkedEventIdForBatch,
            }),
          );
          createdIds.push(created.booking_request_id);
          if (created.event_id && !linkedEventIdForBatch) {
            linkedEventIdForBatch = created.event_id;
          }
          track(MixpanelEvents.enquiry_created, {
            booking_id: created.booking_request_id,
            vendor_user_id: vendor.user_id,
            option_count: 1,
            source: resolvedSource,
          });
        } catch (err: unknown) {
          track(MixpanelEvents.enquiry_failed, {
            vendor_user_id: vendor.user_id,
            source: resolvedSource,
          });
          failures.push(
            `${vendorLabel(vendor)}: ${getApiErrorDetail(err) ?? "failed"}`,
          );
        }
      }
      setSubmitting(false);
      if (createdIds.length === 0) {
        setError(failures.join("\n") || CLIENT_BOOKING_ERROR_COPY.multiEnquireNone);
        await withMutationFeedback(showToast, {
          successTitle: CLIENT_BOOKING_TOAST_COPY.requestsNotSent,
          showSuccessToast: false,
          errorTitle: CLIENT_BOOKING_TOAST_COPY.requestsNotSent,
          errorDescription: failures[0] ?? CLIENT_BOOKING_ERROR_COPY.multiEnquireNone,
          run: () => Promise.reject(new Error("none sent")),
        });
        return;
      }
      if (failures.length > 0) {
        setError(
          `Sent ${createdIds.length} of ${optionIdsByVendor.length} requests.\n\n${failures.join("\n")}`,
        );
        await withMutationFeedback(showToast, {
          successTitle: CLIENT_BOOKING_TOAST_COPY.partialRequestsSent(
            createdIds.length,
            optionIdsByVendor.length,
          ),
          showSuccessToast: false,
          errorTitle: CLIENT_BOOKING_TOAST_COPY.partialRequestsSent(
            createdIds.length,
            optionIdsByVendor.length,
          ),
          errorDescription: `${failures.length} could not be sent. See details in the form.`,
          run: () => Promise.reject(new Error("partial")),
        });
        return;
      }
      track(MixpanelEvents.multi_enquiry_created, {
        created_count: createdIds.length,
        requested_count: optionIdsByVendor.length,
        source: resolvedSource,
      });
      onSuccess(createdIds);
    })();
  };

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={`Request from ${vendors.length} vendors`}
      maxWidthClassName="max-w-xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            Send requests
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <MultiVendorPackagePicker
          vendors={vendors}
          selectedOptionByVendorId={selectedOptionByVendorId}
          onSelectOption={(vendorUserId, optionId) => {
            setSelectedOptionByVendorId((prev) => ({ ...prev, [vendorUserId]: optionId }));
            const vendor = vendors.find((entry) => entry.user_id === vendorUserId);
            const option = vendor
              ? pricingOptionsForVendor(vendor).find((entry) => entry.id === optionId)
              : undefined;
            setQuantityByVendorId((prev) => {
              const next = { ...prev };
              if (option?.pricingMode === "per_unit") {
                next[vendorUserId] = defaultQuantityForOption(option);
              } else {
                delete next[vendorUserId];
              }
              return next;
            });
            setError(null);
          }}
          quantityByVendorId={quantityByVendorId}
          onQuantityChange={(vendorUserId, quantity) => {
            setQuantityByVendorId((prev) => ({ ...prev, [vendorUserId]: quantity }));
            setError(null);
          }}
          vendorCategoryLabels={vendorCategoryLabels}
        />
        {error ? <LottieFailureInline message={error} /> : null}
        {calendarConflictMessage ? (
          <Banner tone="warning">{calendarConflictMessage}</Banner>
        ) : null}
        {loadWarning ? (
          <Banner tone="warning" className="whitespace-pre-wrap">
            {loadWarning}
          </Banner>
        ) : null}
        {bannerVisible && pendingPrefill ? (
          <ActiveEventPrefillBanner
            prefill={pendingPrefill}
            onUse={() => {
              applyBannerPrefill();
              setError(null);
            }}
            onNewEvent={dismissForNewEvent}
          />
        ) : null}
        <label className="block text-sm">
          <span className="font-medium text-neutral-800">Event name</span>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-base md:text-sm"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g. Summer garden party"
            maxLength={500}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-neutral-800">Event date</span>
            <DateInput
              id="multi-enquire-event-date"
              min={todayIsoDate()}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              shellClassName="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-800">End date (optional)</span>
            <DateInput
              id="multi-enquire-event-end"
              allowEmpty
              min={eventDate.trim() || todayIsoDate()}
              value={eventEndDate}
              onChange={(e) => setEventEndDate(e.target.value)}
              shellClassName="mt-1"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-neutral-800">Venue address (optional)</span>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-base md:text-sm"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            maxLength={500}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-neutral-800">Notes (optional)</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-base md:text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={CLIENT_BOOKING_NOTES_MAX_LENGTH}
          />
        </label>
      </div>
    </Modal>
  );
}
