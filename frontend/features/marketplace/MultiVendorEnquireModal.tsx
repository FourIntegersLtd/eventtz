"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  postBookingRequest,
  type ClientSearchContext,
} from "@/lib/clientBookingsApi";
import { buildBrowsePricingOptions } from "@/features/client/browse/vendorBrowseDetailModel";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";
import { todayIsoDate } from "@/lib/eventDateValidation";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { clientBookingRequestSchema, parseForm } from "@/lib/validation";

type MultiVendorEnquireModalProps = {
  vendors: ExploreVendorSearchRow[];
  clientSearchContext: ClientSearchContext;
  searchPrefill?: {
    eventDate?: string;
    eventEndDate?: string;
    datesFlexible: boolean;
  };
  onClose: () => void;
  onSuccess: (createdIds: string[]) => void;
};

function cheapestOptionId(vendor: ExploreVendorSearchRow): string | null {
  const options = buildBrowsePricingOptions(vendor);
  const priced = options.filter(
    (o) => o.unitPriceGbp != null && Number.isFinite(o.unitPriceGbp),
  );
  if (priced.length === 0) return options[0]?.id ?? null;
  return priced.reduce((best, o) =>
    (o.unitPriceGbp ?? Infinity) < (best.unitPriceGbp ?? Infinity) ? o : best,
  ).id;
}

function vendorLabel(v: ExploreVendorSearchRow): string {
  const p = v.payload ?? {};
  const name = typeof p.businessName === "string" ? p.businessName.trim() : "";
  return name || "Vendor";
}

/**
 * Shared brief for contacting several vendors at once (one booking request each).
 * Uses each vendor’s cheapest (or first) package as the selected option.
 */
export function MultiVendorEnquireModal({
  vendors,
  clientSearchContext,
  searchPrefill,
  onClose,
  onSuccess,
}: MultiVendorEnquireModalProps) {
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(
    searchPrefill?.eventDate?.trim() ? searchPrefill.eventDate : todayIsoDate(),
  );
  const [eventEndDate, setEventEndDate] = useState(searchPrefill?.eventEndDate ?? "");
  const [venueAddress, setVenueAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const namedVendors = useMemo(
    () => vendors.map((v) => ({ id: v.user_id, label: vendorLabel(v) })),
    [vendors],
  );

  const submit = () => {
    const optionIdsByVendor = vendors.map((v) => ({
      vendor: v,
      optionId: cheapestOptionId(v),
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
            },
          });
          createdIds.push(created.id);
          track(MixpanelEvents.enquiry_created, {
            booking_id: created.id,
            vendor_user_id: vendor.user_id,
            option_count: 1,
            source: "multi",
          });
        } catch (err: unknown) {
          track(MixpanelEvents.enquiry_failed, {
            vendor_user_id: vendor.user_id,
            source: "multi",
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
      maxWidthClassName="max-w-lg"
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
        <ul className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-800">
          {namedVendors.map((n) => (
            <li key={n.id} className="py-0.5">
              {n.label}
            </li>
          ))}
        </ul>
        {error ? (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="whitespace-pre-wrap">{error}</p>
          </div>
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
