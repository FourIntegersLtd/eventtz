import type { ClientSearchContext, CreateBookingRequestPayload } from "@/lib/clientBookingsApi";
import type { ClientBookingRequestInput } from "@/lib/validation/bookings";

export function buildBookingRequestPayload(
  parsed: ClientBookingRequestInput,
  options: {
    vendorUserId: string;
    selectedOptionIds: string[];
    quantities?: Record<string, number>;
    clientSearchContext?: ClientSearchContext | null;
    eventId?: string | null;
    vendorReferralCode?: string | null;
  },
): CreateBookingRequestPayload {
  return {
    vendor_user_id: options.vendorUserId,
    event_name: parsed.eventName,
    event_date: parsed.eventDate,
    event_end_date: parsed.eventEndDate?.trim() || null,
    event_postcode: null,
    event_address: (parsed.venueAddress ?? "").trim() || null,
    notes: (parsed.notes ?? "").trim() || null,
    selected_option_ids: options.selectedOptionIds,
    quantities: options.quantities,
    client_search_context: options.clientSearchContext ?? undefined,
    event_id: options.eventId ?? null,
    vendor_referral_code: options.vendorReferralCode?.trim() || null,
  };
}
