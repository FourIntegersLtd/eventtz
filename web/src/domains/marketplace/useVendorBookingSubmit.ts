"use client";

/**
 * Validate a booking enquiry and post it.
 * The body is built by `buildBookingRequestPayload`, which has no price fields.
 * Mixpanel is not sent: this app has no analytics client.
 */
import { useCallback, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { createClientBookingRequest } from "./api";
import { buildBookingRequestPayload, type BookingRequestBuildOptions } from "./bookingRequestPayload";
import {
  validateClientBookingEnquiry,
  type ClientBookingEnquiryFields,
} from "./bookingRequestValidation";
import type { ClientSearchContext } from "./marketplaceSearchParams";
import type { BookingQuantityOption } from "./vendorBrowseDetailModel";

const REQUEST_FAILED = "Request failed. Try again.";

export type VendorBookingSubmitFields = ClientBookingEnquiryFields & {
  vendorReferralCode?: string | null;
};

type UseVendorBookingSubmitArgs = {
  vendorUserId: string;
  selectedEventId: string | null;
  clientSearchContext?: ClientSearchContext | null;
  calendarConflict: boolean;
  quantityOptions: readonly BookingQuantityOption[];
};

export type VendorBookingSubmitResult =
  | { type: "error"; message: string }
  | { type: "success"; bookingId: string };

/** Validation banner, in-flight flag, and the success or error result. */
export function useVendorBookingSubmit({
  vendorUserId,
  selectedEventId,
  clientSearchContext,
  calendarConflict,
  quantityOptions,
}: UseVendorBookingSubmitArgs) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<VendorBookingSubmitResult | null>(null);

  const dismissResultModal = useCallback(() => setSubmitResult(null), []);

  const submit = useCallback(
    (fields: VendorBookingSubmitFields) => {
      const parsed = validateClientBookingEnquiry(fields, calendarConflict);
      if (!parsed.ok) {
        setValidationError(parsed.error);
        return;
      }
      setValidationError(null);
      setSubmitting(true);
      const options: BookingRequestBuildOptions = {
        vendorUserId,
        selectedOptionIds: parsed.data.selectedOptionIds,
        quantities: parsed.data.quantities,
        quantityOptions,
        clientSearchContext,
        eventId: selectedEventId,
        vendorReferralCode: fields.vendorReferralCode,
      };
      void createClientBookingRequest(buildBookingRequestPayload(parsed.data, options))
        .then((created) => {
          setSubmitResult({ type: "success", bookingId: created.booking_request_id });
          setSubmitting(false);
        })
        .catch((error: unknown) => {
          const detail = platformErrorDetail(error);
          setSubmitResult({
            type: "error",
            message: detail ? detail : REQUEST_FAILED,
          });
          setSubmitting(false);
        });
    },
    [vendorUserId, selectedEventId, clientSearchContext, calendarConflict, quantityOptions],
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
