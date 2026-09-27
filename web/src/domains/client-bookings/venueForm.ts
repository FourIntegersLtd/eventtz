/**
 * Validation and request-body building for the pay-page venue step, ported
 * from the baseline's `venueAddressSchema`. The pay step collects an address
 * only — the baseline has no postcode field on this page.
 */
import { z } from "zod";
import { parseForm, type ParseOk, type ParseFail } from "@/domains/client-bookings/parseForm";
import type { UpdateBookingVenueBody } from "@/domains/client-bookings/api";

export const venueSchema = z.object({
  eventAddress: z.string().trim().min(3, "Enter a full event address.").max(500, "Address is too long."),
});

export type VenueFormInput = z.infer<typeof venueSchema>;

/** Validates the venue address; a failure carries the field error and a banner message. */
export function parseVenueForm(input: unknown): ParseOk<VenueFormInput> | ParseFail {
  return parseForm(venueSchema, input);
}

/** Builds the `PATCH .../venue` body from a validated address. */
export function toUpdateVenueBody(input: VenueFormInput): UpdateBookingVenueBody {
  return { event_address: input.eventAddress };
}
