"use client";

import { useCallback, useState } from "react";
import { getApiErrorDetail } from "@/lib/api-errors";
import { buildBookingRequestPayload } from "@/lib/bookingEnquireSubmit";
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
  quantities?: Record<string, number>;
  vendorReferralCode?: string | null;
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
        quantities: fields.quantities,
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
      void postBookingRequest(
        buildBookingRequestPayload(parsed.data, {
          vendorUserId,
          selectedOptionIds: parsed.data.selectedOptionIds,
          quantities: parsed.data.quantities,
          clientSearchContext,
          eventId: selectedEventId,
          vendorReferralCode: fields.vendorReferralCode,
        }),
      )
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
