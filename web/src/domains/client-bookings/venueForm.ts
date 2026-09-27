/**
 * Validation and request-body building for the booking-detail venue form,
 * ported from the baseline's `lib/validation/common.ts` `venueAddressSchema`
 * and `lib/clientBookingsApi.ts` `patchClientBookingVenue`.
 */
import { z } from "zod";
import { parseForm, type ParseOk, type ParseFail } from "@/domains/client-bookings/parseForm";
import type { UpdateBookingVenueBody } from "@/domains/client-bookings/api";

export const venueSchema = z.object({
  eventAddress: z.string().trim().min(3, "Enter a full event address.").max(500, "Address is too long."),
  eventPostcode: z.string().trim().optional(),
});

export type VenueFormInput = z.infer<typeof venueSchema>;

/** Validates the venue form; a failure carries per-field errors plus a single banner message. */
export function parseVenueForm(input: unknown): ParseOk<VenueFormInput> | ParseFail {
  return parseForm(venueSchema, input);
}

/** Builds the `PATCH .../venue` body; the postcode is sent only when non-blank. */
export function toUpdateVenueBody(input: VenueFormInput): UpdateBookingVenueBody {
  const body: UpdateBookingVenueBody = { event_address: input.eventAddress };
  const postcode = input.eventPostcode?.trim() ?? "";
  if (postcode) body.event_postcode = postcode;
  return body;
}
