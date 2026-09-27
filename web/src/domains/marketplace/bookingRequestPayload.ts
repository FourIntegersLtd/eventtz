/**
 * Build `POST /api/v1/client/booking-requests`.
 * The argument types have no price, total, fee, or amount. The API reprices
 * from `selected_option_ids` and per-unit `quantities`.
 */
import type { CreateBookingRequestBody } from "./api";
import type { ClientSearchContext } from "./marketplaceSearchParams";
import { bookingQuantitiesPayload, type BookingQuantityOption } from "./vendorBrowseDetailModel";
import { normalizeVendorReferralCode } from "./vendorReferralAttribution";

/** Validated form text. Package prices are not accepted. */
export type BookingRequestFormInput = {
  eventName: string;
  eventDate: string;
  eventEndDate?: string | null;
  venueAddress?: string;
  notes?: string;
  selectedOptionIds: string[];
};

/**
 * Everything else the create call needs.
 * `quantityOptions` carries id, pricing mode, and minimum only.
 */
export type BookingRequestBuildOptions = {
  vendorUserId: string;
  selectedOptionIds: string[];
  quantities?: Record<string, number>;
  quantityOptions?: readonly BookingQuantityOption[];
  clientSearchContext?: ClientSearchContext | null;
  eventId?: string | null;
  vendorReferralCode?: string | null;
};

function searchContextRecord(
  context: ClientSearchContext | null | undefined,
): CreateBookingRequestBody["client_search_context"] {
  if (!context) return null;
  const record: Record<string, unknown> = {};
  if (context.q) record.q = context.q;
  if (context.types && context.types.length > 0) record.types = context.types;
  if (context.location) record.location = context.location;
  if (context.country) record.country = context.country;
  if (context.dates && context.dates.length > 0) record.dates = context.dates;
  if (context.dateFlexible) record.dateFlexible = context.dateFlexible;
  if (context.source) record.source = context.source;
  if (context.plannerPlanId) record.plannerPlanId = context.plannerPlanId;
  if (context.batchSize != null) record.batchSize = context.batchSize;
  if (context.batchIndex != null) record.batchIndex = context.batchIndex;
  return record;
}

/**
 * Map a validated form onto `CreateBookingRequestBody`.
 * When `quantityOptions` is set, only per-unit ids are sent, each clamped to
 * its minimum. With none of those, `quantities` is null.
 */
export function buildBookingRequestPayload(
  form: BookingRequestFormInput,
  options: BookingRequestBuildOptions,
): CreateBookingRequestBody {
  const clamped = options.quantityOptions
    ? bookingQuantitiesPayload(
        options.selectedOptionIds,
        options.quantityOptions,
        options.quantities ?? {},
      )
    : options.quantities;
  return {
    vendor_user_id: options.vendorUserId,
    event_name: form.eventName.trim(),
    event_date: form.eventDate.trim(),
    event_end_date: form.eventEndDate?.trim() || null,
    event_postcode: null,
    event_address: (form.venueAddress ?? "").trim() || null,
    notes: (form.notes ?? "").trim() || null,
    selected_option_ids: [...options.selectedOptionIds],
    quantities: clamped ?? null,
    client_search_context: searchContextRecord(options.clientSearchContext),
    event_id: options.eventId ?? null,
    vendor_referral_code: normalizeVendorReferralCode(options.vendorReferralCode),
  };
}
