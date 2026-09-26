import { platformRequest, type components } from "@/foundation/platform-client";

/**
 * The vendor bookings domain's requests.
 *
 * Components never call `platformRequest` directly (enforced by
 * `eslint.config.mjs`'s `no-restricted-imports`) — they go through the
 * exported functions here. Every shape below is re-exported from the
 * generated `schema.d.ts` rather than hand-typed, so a change to
 * `api/openapi.json` shows up here as a compile error instead of a silent
 * drift.
 */

export type VendorBookingListItem = components["schemas"]["VendorBookingListItem"];
export type VendorBookingDetail = components["schemas"]["VendorBookingDetail"];
export type VendorAdjustmentItem = components["schemas"]["VendorAdjustmentItem"];
export type VendorAdjustmentIn = components["schemas"]["VendorAdjustmentIn"];
export type BookingPricingBreakdown = components["schemas"]["BookingPricingBreakdown"];
export type VendorReviewSummary = components["schemas"]["VendorReviewSummary"];
export type BookingLineItemIn = components["schemas"]["BookingLineItemIn"];
export type DisputePublic = components["schemas"]["DisputePublic"];

/** The bucket a booking falls into on the list screen. */
export type VendorBookingsListGroup = "active" | "completed" | "closed" | "all";

/** Optional filters accepted by `GET /vendor/booking-requests`. */
export type VendorBookingsListParams = {
  group?: VendorBookingsListGroup;
  status?: string;
  paymentStatus?: string;
  excludePaymentStatus?: string;
};

/** The vendor's bookings in one bucket, most recently active first. */
export function fetchVendorBookings(params: VendorBookingsListParams = {}): Promise<VendorBookingListItem[]> {
  return platformRequest<components["schemas"]["VendorBookingsListResponse"]>("/api/v1/vendor/booking-requests", {
    query: {
      group: params.group ?? "active",
      status: params.status,
      payment_status: params.paymentStatus,
      exclude_payment_status: params.excludePaymentStatus,
    },
  }).then((response) => response.bookings);
}

/** One booking with its price breakdown, the client's contact once paid, and any review. */
export function fetchVendorBookingDetail(bookingId: string): Promise<VendorBookingDetail> {
  return platformRequest<components["schemas"]["VendorBookingDetailResponse"]>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}`,
  ).then((response) => response.booking);
}

/** Accept, decline or cancel a booking (withdrawing a sent quote is a cancel). */
export function patchVendorBookingStatus(
  bookingId: string,
  status: components["schemas"]["VendorBookingStatusBody"]["status"],
): Promise<components["schemas"]["VendorBookingStatusResponse"]> {
  return platformRequest<components["schemas"]["VendorBookingStatusResponse"]>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}/status`,
    { method: "PATCH", body: { status } },
  );
}

/** Replace the extras and discounts on a pending request; the client must confirm the new price. */
export function putVendorBookingAdjustments(
  bookingId: string,
  adjustments: VendorAdjustmentIn[],
): Promise<VendorBookingDetail> {
  return platformRequest<components["schemas"]["PutVendorBookingAdjustmentsResponse"]>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}/adjustments`,
    { method: "PUT", body: { adjustments } },
  ).then((response) => response.booking);
}

/** Confirm the event went ahead; the payout follows once the client confirms too. */
export function postVendorConfirmCompletion(
  bookingId: string,
): Promise<components["schemas"]["ConfirmCompletionResponse"]> {
  return platformRequest<components["schemas"]["ConfirmCompletionResponse"]>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}/confirm-completion`,
    { method: "POST" },
  );
}

/**
 * Send a client a priced quote (optionally from a chat thread); it waits for
 * their answer. Not wired to a page in this workstream — the baseline
 * triggers it from the messaging thread, which is a different workstream's
 * domain. Kept here so the endpoint has a typed caller ready for it.
 */
export function postVendorQuote(
  body: components["schemas"]["CreateVendorQuoteBody"],
): Promise<components["schemas"]["BookingRequestCreated"]> {
  return platformRequest<components["schemas"]["BookingRequestCreated"]>(
    "/api/v1/vendor/booking-requests/vendor-quote",
    { method: "POST", body },
  );
}

/** Disputes on this booking; an empty list if the vendor isn't a party to it. */
export function fetchVendorBookingDisputes(bookingId: string): Promise<DisputePublic[]> {
  return platformRequest<components["schemas"]["DisputesListResponse"]>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}/disputes`,
  ).then((response) => response.disputes);
}

/** Open a dispute on one of the vendor's own bookings. */
export function postVendorBookingDispute(bookingId: string, summary: string): Promise<DisputePublic> {
  return platformRequest<components["schemas"]["CreateDisputeResponse"]>(
    `/api/v1/vendor/booking-requests/${encodeURIComponent(bookingId)}/disputes`,
    { method: "POST", body: { summary } },
  ).then((response) => response.dispute);
}
