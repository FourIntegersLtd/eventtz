"use client";

import { useCallback, useState } from "react";
import { getApiErrorDetail } from "@/lib/api-errors";
import { postBookingRequest, type ClientSearchContext } from "@/lib/clientBookingsApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { clientBookingRequestSchema, parseForm } from "@/lib/validation";
import {
  CLIENT_BOOKING_ERROR_COPY,
} from "@/features/bookings/bookingConfirmCopy";

export type VendorBookingSubmitFields = {
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
  notes: string;
  selectedOptionIds: string[];
};

type UseVendorBookingSubmitArgs = {
  vendorUserId: string;
  selectedEventId: string | null;
  clientSearchContext?: ClientSearchContext | null;
  calendarConflict: boolean;
};

export function useVendorBookingSubmit({
  vendorUserId,
  selectedEventId,
  clientSearchContext,
  calendarConflict,
}: UseVendorBookingSubmitArgs) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<
    null | { type: "error"; message: string } | { type: "success"; bookingId: string }
  >(null);

  const dismissResultModal = useCallback(() => setSubmitResult(null), []);

  const submit = useCallback(
    (fields: VendorBookingSubmitFields) => {
      const parsed = parseForm(clientBookingRequestSchema, {
        eventName: fields.eventName,
        eventDate: fields.eventDate,
        eventEndDate: fields.eventEndDate || null,
        venueAddress: fields.venueAddress,
        notes: fields.notes,
        selectedOptionIds: fields.selectedOptionIds,
      });
      if (!parsed.ok) {
        setValidationError(parsed.formError);
        return;
      }
      if (calendarConflict) {
        setValidationError(
          "These dates don't match this vendor's availability. Adjust the dates or message them to confirm.",
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
        client_search_context: clientSearchContext ?? undefined,
        event_id: selectedEventId,
      })
        .then((created) => {
          track(MixpanelEvents.enquiry_created, {
            booking_id: created.booking_request_id,
            vendor_user_id: vendorUserId,
            option_count: parsed.data.selectedOptionIds.length,
            source: "single",
          });
          setSubmitResult({ type: "success", bookingId: created.booking_request_id });
          setSubmitting(false);
        })
        .catch((err: unknown) => {
          track(MixpanelEvents.enquiry_failed, {
            vendor_user_id: vendorUserId,
            source: "single",
          });
          setSubmitResult({
            type: "error",
            message: getApiErrorDetail(err) ?? CLIENT_BOOKING_ERROR_COPY.enquiryFailed,
          });
          setSubmitting(false);
        });
    },
    [vendorUserId, selectedEventId, clientSearchContext, calendarConflict],
  );

  return {
    validationError,
    setValidationError,
    submitting,
    submitResult,
    dismissResultModal,
    submit,
  };
}
