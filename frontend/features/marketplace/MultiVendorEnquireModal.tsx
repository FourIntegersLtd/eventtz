"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  postBookingRequest,
  type ClientSearchContext,
} from "@/lib/clientBookingsApi";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";
import {
  initialOptionSelections,
  vendorDisplayName,
} from "@/features/bookings/multiVendorPackageSelection";
import {
  MultiVendorPackagePicker,
} from "@/features/bookings/MultiVendorPackagePicker";
import { todayIsoDate } from "@/lib/eventDateValidation";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { clientBookingRequestSchema, parseForm } from "@/lib/validation";
import { ActiveEventPrefillBanner } from "@/features/bookings/ActiveEventPrefillBanner";
import type { EventEnquirePrefill } from "@/features/bookings/eventEnquirePrefill";
import {
  applyPrefillToFields,
  applyLinkedPrefillToForm,
  useActiveEventPrefill,
} from "@/features/bookings/useActiveEventPrefill";

type MultiVendorEnquireModalProps = {
  vendors: ExploreVendorSearchRow[];
  clientSearchContext: ClientSearchContext;
  searchPrefill?: {
    eventDate?: string;
    eventEndDate?: string;
    datesFlexible: boolean;
  };
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

function vendorLabel(v: ExploreVendorSearchRow): string {
  return vendorDisplayName(v);
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
  const [selectedOptionByVendorId, setSelectedOptionByVendorId] = useState<
    Record<string, string>
  >(() => initialOptionSelections(vendors));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    pendingPrefill,
    linkedPrefill,
    selectedEventId,
    bannerVisible,
    applyPrefill,
    dismissForNewEvent,
  } = useActiveEventPrefill({ linkedEventId });

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

  useEffect(() => {
    setSelectedOptionByVendorId(initialOptionSelections(vendors));
  }, [vendors]);

  const submit = () => {
    const optionIdsByVendor = vendors.map((v) => ({
      vendor: v,
      optionId: selectedOptionByVendorId[v.user_id] ?? null,
    }));
    const missing = optionIdsByVendor.filter((x) => !x.optionId);
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

    setError(null);
    setSubmitting(true);
    void (async () => {
      const createdIds: string[] = [];
      const failures: string[] = [];
      const batchSize = optionIdsByVendor.length;
      let linkedEventId = selectedEventId;
      for (let i = 0; i < optionIdsByVendor.length; i += 1) {
        const { vendor, optionId } = optionIdsByVendor[i]!;
        try {
          const created = await postBookingRequest({
            vendor_user_id: vendor.user_id,
            event_name: parsed.data.eventName,
            event_date: parsed.data.eventDate,
            event_end_date: parsed.data.eventEndDate?.trim() || null,
            event_postcode: null,
            event_address: (parsed.data.venueAddress ?? "").trim() || null,
            notes: (parsed.data.notes ?? "").trim() || null,
            selected_option_ids: [optionId!],
            client_search_context: {
              ...clientSearchContext,
              batchSize,
              batchIndex: i,
              source: enquirySource,
            },
            event_id: linkedEventId,
          });
          createdIds.push(created.id);
          if (created.event_id && !linkedEventId) {
            linkedEventId = created.event_id;
          }
          track(MixpanelEvents.enquiry_created, {
            booking_id: created.id,
            vendor_user_id: vendor.user_id,
            option_count: 1,
            source: enquirySource,
          });
        } catch (err: unknown) {
          track(MixpanelEvents.enquiry_failed, {
            vendor_user_id: vendor.user_id,
            source: enquirySource,
          });
          failures.push(
            `${vendorLabel(vendor)}: ${getApiErrorDetail(err) ?? "failed"}`,
          );
        }
      }
      setSubmitting(false);
      if (createdIds.length === 0) {
        setError(failures.join("\n") || "Could not send any requests.");
        return;
      }
      track(MixpanelEvents.multi_enquiry_created, {
        created_count: createdIds.length,
        requested_count: optionIdsByVendor.length,
        source: enquirySource,
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
            setError(null);
          }}
          vendorCategoryLabels={vendorCategoryLabels}
        />
        {error ? (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="whitespace-pre-wrap">{error}</p>
          </div>
        ) : null}
        {loadWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 whitespace-pre-wrap">
            {loadWarning}
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
              setError(null);
            }}
            onNewEvent={dismissForNewEvent}
          />
        ) : null}
        <label className="block text-sm">
          <span className="font-medium text-neutral-800">Event name</span>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
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
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            maxLength={500}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-neutral-800">Notes (optional)</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
          />
        </label>
      </div>
    </Modal>
  );
}
